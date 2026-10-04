const pool = require("../config/db");
const buildCrud = require("../utils/crudFactory");

const categories = buildCrud("part_categories", ["name"], "id", "name ASC");
const parts = buildCrud(
  "parts",
  ["part_code", "name", "category_id", "unit", "minimum_stock", "unit_price", "status"],
  "id",
  "name ASC"
);

// GET /api/inventory/parts — parts joined with category name and total
// quantity on hand across all warehouse locations, plus a low_stock flag
// so the frontend doesn't need to compute it.
const getPartsWithStock = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, pc.name AS category_name,
             COALESCE(SUM(i.quantity), 0)::int AS total_quantity,
             (COALESCE(SUM(i.quantity), 0) < p.minimum_stock) AS low_stock
      FROM parts p
      LEFT JOIN part_categories pc ON p.category_id = pc.id
      LEFT JOIN inventory i ON i.part_id = p.id
      GROUP BY p.id, pc.name
      ORDER BY p.name ASC
    `);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("❌ Failed to fetch parts with stock:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch parts" });
  }
};

// GET /api/inventory/stock/:partId — per-location breakdown for one part.
const getStockForPart = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM inventory WHERE part_id = $1 ORDER BY location ASC",
      [req.params.partId]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch stock" });
  }
};

// POST /api/inventory/stock/adjust
// Body: { partId, location, quantityChange, transactionType, referenceType, referenceId }
// quantityChange is signed (+10 received, -1 used). Upserts the
// inventory row and always writes a stock_transactions row so there's
// a real audit trail behind every quantity change.
const adjustStock = async (req, res) => {
  const client = await pool.connect();
  try {
    const { partId, location, quantityChange, transactionType, referenceType, referenceId, reason } = req.body;

    if (!partId || !location || !quantityChange || !transactionType) {
      return res.status(400).json({
        success: false,
        message: "partId, location, quantityChange, and transactionType are required",
      });
    }

    const auditReason = reason && String(reason).trim() ? String(reason).trim() : (transactionType === "RECEIVED" ? "Depot replenishment received" : "Physical count reconciliation");

    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT * FROM inventory WHERE part_id = $1 AND location = $2 FOR UPDATE",
      [partId, location]
    );

    let inventoryRow;
    if (existing.rows.length === 0) {
      const inserted = await client.query(
        `INSERT INTO inventory (part_id, location, quantity) VALUES ($1, $2, $3) RETURNING *`,
        [partId, location, Math.max(0, quantityChange)]
      );
      inventoryRow = inserted.rows[0];
    } else {
      const newQty = existing.rows[0].quantity + Number(quantityChange);
      if (newQty < 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Adjustment would make stock negative" });
      }
      const updated = await client.query(
        `UPDATE inventory SET quantity = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [newQty, existing.rows[0].id]
      );
      inventoryRow = updated.rows[0];
    }

    await client.query(
      `INSERT INTO stock_transactions (
         part_id, inventory_id, transaction_type, quantity, reference_type, reference_id, user_id, reason
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        partId,
        inventoryRow.id,
        transactionType,
        quantityChange,
        referenceType || "manual",
        referenceId || null,
        req.user?.id || null,
        auditReason,
      ]
    );

    await client.query("COMMIT");

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "STOCK_ADJUSTED",
      entityType: "INVENTORY",
      entityId: inventoryRow.id,
      newData: { partId, location, quantityChange, transactionType, reason: auditReason },
    });

    res.status(200).json({ success: true, message: "Stock updated with audit trail", data: inventoryRow });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to adjust stock:", error.message);
    res.status(500).json({ success: false, message: "Failed to adjust stock" });
  } finally {
    client.release();
  }
};

// GET /api/inventory/transactions/:partId — history for one part.
const getTransactionsForPart = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM stock_transactions WHERE part_id = $1 ORDER BY created_at DESC LIMIT 50",
      [req.params.partId]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch stock history" });
  }
};

const auditModel = require("../models/auditModel");

// ---------------------------------------------------------------------
// SPARE PART REQUESTS & APPROVAL WORKFLOW
// ---------------------------------------------------------------------

// GET /api/inventory/requests — Lists part requests with filters
const listPartRequests = async (req, res) => {
  try {
    const { status, work_order_id, my_requests } = req.query;
    const conditions = [];
    const values = [];

    if (status && status !== "ALL") {
      values.push(status);
      conditions.push(`pr.status = $${values.length}`);
    }

    if (work_order_id) {
      values.push(Number(work_order_id));
      conditions.push(`pr.work_order_id = $${values.length}`);
    }

    // If technician asks for their own requests or requested via my_requests=true
    if (my_requests === "true" || (req.user.role_name === "TECHNICIAN" && !req.query.all)) {
      values.push(req.user.id);
      conditions.push(`pr.requested_by = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT pr.*,
             p.part_code, p.name AS part_name, p.unit AS unit_of_measure, p.unit_price,
             requester.name AS requester_name, requester.email AS requester_email,
             reviewer.name AS reviewer_name, reviewer.email AS reviewer_email,
             wo.title AS work_order_title, wo.priority AS work_order_priority,
             a.asset_code, a.name AS asset_name,
             COALESCE(inv_summary.total_stock, 0)::int AS available_stock
      FROM part_requests pr
      JOIN parts p ON pr.part_id = p.id
      LEFT JOIN users requester ON pr.requested_by = requester.id
      LEFT JOIN users reviewer ON pr.reviewed_by = reviewer.id
      LEFT JOIN work_orders wo ON pr.work_order_id = wo.id
      LEFT JOIN assets a ON wo.asset_id = a.id
      LEFT JOIN (
        SELECT part_id, SUM(quantity) AS total_stock
        FROM inventory
        GROUP BY part_id
      ) inv_summary ON inv_summary.part_id = p.id
      ${whereClause}
      ORDER BY 
        CASE pr.status WHEN 'PENDING' THEN 1 WHEN 'APPROVED' THEN 2 ELSE 3 END,
        pr.created_at DESC
    `;

    const result = await pool.query(query, values);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("❌ Failed to list part requests:", error.message);
    res.status(500).json({ success: false, message: "Failed to list part requests" });
  }
};

// POST /api/inventory/requests — Technician submits a spare part requisition
const createPartRequest = async (req, res) => {
  try {
    const { part_id, quantity, work_order_id, urgency, reason } = req.body;
    const qty = Number(quantity);

    if (!part_id || !qty || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid part_id and positive quantity are required",
      });
    }

    const result = await pool.query(
      `INSERT INTO part_requests (
         part_id, quantity, work_order_id, requested_by, urgency, reason, status
       )
       VALUES ($1, $2, $3, $4, COALESCE($5, 'MEDIUM'), $6, 'PENDING')
       RETURNING *`,
      [
        part_id,
        qty,
        work_order_id ? Number(work_order_id) : null,
        req.user.id,
        urgency,
        reason || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Spare part request submitted for supervisor approval",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Failed to create part request:", error.message);
    res.status(500).json({ success: false, message: "Failed to submit part request" });
  }
};

// PATCH /api/inventory/requests/:id/approve — Engineer approves technical requirement (Authorization only, no stock deduction yet)
const approvePartRequest = async (req, res) => {
  try {
    const requestId = Number(req.params.id);

    const reqRes = await pool.query(
      "SELECT * FROM part_requests WHERE id = $1",
      [requestId]
    );
    const request = reqRes.rows[0];

    if (!request) {
      return res.status(404).json({ success: false, message: "Part request not found" });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Request cannot be approved from current status: ${request.status}`,
      });
    }

    const updatedRes = await pool.query(
      `UPDATE part_requests
       SET status = 'APPROVED',
           reviewed_by = $1,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.user.id, requestId]
    );

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "SPARE_PART_REQUEST_APPROVED",
      entityType: "PART_REQUEST",
      entityId: requestId,
      newData: {
        part_id: request.part_id,
        quantity: request.quantity,
        status: "APPROVED",
      },
    });

    res.status(200).json({
      success: true,
      message: `Technical requirement approved for ${request.quantity}x unit(s). Ready for warehouse physical issuance.`,
      data: updatedRes.rows[0],
    });
  } catch (error) {
    console.error("❌ Failed to approve part request:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to approve part request" });
  }
};

// PATCH /api/inventory/requests/:id/issue — Warehouse / Admin physically issues part & deducts stock
const issuePartRequest = async (req, res) => {
  const client = await pool.connect();
  try {
    const requestId = Number(req.params.id);
    const location = req.body.location || "Main Warehouse";

    await client.query("BEGIN");

    const reqRes = await client.query(
      "SELECT * FROM part_requests WHERE id = $1 FOR UPDATE",
      [requestId]
    );
    const request = reqRes.rows[0];

    if (!request) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Part request not found" });
    }

    if (request.status !== "APPROVED" && request.status !== "PENDING") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Part request must be APPROVED before physical issuance. Current status: ${request.status}`,
      });
    }

    // Check inventory stock in location
    let invRes = await client.query(
      "SELECT * FROM inventory WHERE part_id = $1 AND location = $2 FOR UPDATE",
      [request.part_id, location]
    );
    let invRow = invRes.rows[0];

    if (!invRow || invRow.quantity < request.quantity) {
      // Fallback: look for any location with enough stock
      const altRes = await client.query(
        "SELECT * FROM inventory WHERE part_id = $1 AND quantity >= $2 ORDER BY quantity DESC LIMIT 1 FOR UPDATE",
        [request.part_id, request.quantity]
      );
      if (altRes.rows.length === 0) {
        const totalRes = await client.query(
          "SELECT COALESCE(SUM(quantity), 0)::int AS total FROM inventory WHERE part_id = $1",
          [request.part_id]
        );
        const available = totalRes.rows[0]?.total || 0;
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Insufficient inventory in warehouse. Available: ${available}, requested: ${request.quantity}`,
        });
      }
      invRow = altRes.rows[0];
    }

    // Deduct stock from inventory
    await client.query(
      "UPDATE inventory SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2",
      [request.quantity, invRow.id]
    );

    // Record auditable stock transaction
    await client.query(
      `INSERT INTO stock_transactions (
         part_id, inventory_id, transaction_type, quantity, reference_type, reference_id, user_id, reason
       )
       VALUES ($1, $2, 'PART_ISSUE', $3, 'part_request', $4, $5, $6)`,
      [
        request.part_id,
        invRow.id,
        -request.quantity,
        request.id,
        req.user.id,
        `Physical parts issued to Work Order #${request.work_order_id || 'Depot'}`,
      ]
    );

    // Attach to work_order_parts if linked
    if (request.work_order_id) {
      await client.query(
        `INSERT INTO work_order_parts (work_order_id, part_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [request.work_order_id, request.part_id, request.quantity]
      );

      // Transition work order from WAITING_FOR_PARTS to PARTS_ISSUED
      await client.query(
        `UPDATE work_orders
         SET status = 'PARTS_ISSUED', updated_at = NOW()
         WHERE id = $1 AND status = 'WAITING_FOR_PARTS'`,
        [request.work_order_id]
      );
    }

    // Update request status to ISSUED
    const updatedRes = await client.query(
      `UPDATE part_requests
       SET status = 'ISSUED',
           issued_by = $1,
           issued_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.user.id, requestId]
    );

    await client.query("COMMIT");

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "SPARE_PART_PHYSICALLY_ISSUED",
      entityType: "PART_REQUEST",
      entityId: requestId,
      newData: {
        part_id: request.part_id,
        quantity: request.quantity,
        location: invRow.location,
        work_order_id: request.work_order_id,
      },
    });

    res.status(200).json({
      success: true,
      message: `Parts physically issued from ${invRow.location} and deducted from inventory. Ready for technician installation.`,
      data: updatedRes.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to issue part request:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to issue part request" });
  } finally {
    client.release();
  }
};

// PATCH /api/inventory/requests/:id/used — Technician marks part as installed/used in work order
const markPartUsed = async (req, res) => {
  try {
    const requestId = Number(req.params.id);

    const result = await pool.query(
      `UPDATE part_requests
       SET status = 'USED',
           used_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND status IN ('ISSUED', 'APPROVED')
       RETURNING *`,
      [requestId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Part request must be in ISSUED status to be marked as used",
      });
    }

    res.status(200).json({
      success: true,
      message: "Spare part recorded as installed and consumed in repair.",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Failed to mark part as used:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to mark part as used" });
  }
};

// PATCH /api/inventory/requests/:id/reject — Admin / Engineer rejects requisition
const rejectPartRequest = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const { rejection_reason } = req.body;

    const result = await pool.query(
      `UPDATE part_requests
       SET status = 'REJECTED',
           rejection_reason = $1,
           reviewed_by = $2,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $3 AND status IN ('PENDING', 'APPROVED')
       RETURNING *`,
      [rejection_reason || "Requisition rejected by supervisor", req.user.id, requestId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pending part request not found or already processed",
      });
    }

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "SPARE_PART_REQUEST_REJECTED",
      entityType: "PART_REQUEST",
      entityId: requestId,
      newData: { rejection_reason },
    });

    res.status(200).json({
      success: true,
      message: "Part request rejected",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Failed to reject part request:", error.message);
    res.status(500).json({ success: false, message: "Failed to reject part request" });
  }
};

module.exports = {
  categories,
  parts,
  getPartsWithStock,
  getStockForPart,
  adjustStock,
  getTransactionsForPart,
  listPartRequests,
  createPartRequest,
  approvePartRequest,
  issuePartRequest,
  markPartUsed,
  rejectPartRequest,
};
