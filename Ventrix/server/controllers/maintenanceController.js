const pool = require("../config/db");
const { isCustomerRole } = require("../middleware/roles");
const auditModel = require("../models/auditModel");

const VALID_WORK_ORDER_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_PARTS",
  "COMPLETED",
  "CLOSED",
];

// Helper to guarantee columns exist
async function ensureMaintenanceSchema() {
  try {
    await pool.query(`
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS alert_id INTEGER REFERENCES alerts(id) ON DELETE SET NULL;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS service_request_id INTEGER REFERENCES service_requests(id) ON DELETE SET NULL;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'MEDIUM';
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
      ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);
  } catch (err) {
    // Ignore if already existing
  }
}

// ---------------------------------------------------------------------
// MAINTENANCE SCHEDULES
// ---------------------------------------------------------------------
const getSchedules = async (req, res) => {
  try {
    const orgId = isCustomerRole(req.user.role) ? req.user.organizationId : (req.query.organizationId || null);
    const result = await pool.query(
      `SELECT ms.*, a.asset_code, a.name AS asset_name
       FROM maintenance_schedules ms
       JOIN assets a ON ms.asset_id = a.id
       LEFT JOIN coaches c ON a.coach_id = c.id
       LEFT JOIN trains t ON c.train_id = t.id
       LEFT JOIN projects pj ON t.project_id = pj.id
       WHERE ($1::int IS NULL OR pj.organization_id = $1)
       ORDER BY ms.scheduled_date ASC`,
      [orgId]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("❌ Failed to list maintenance schedules:", error.message);
    res.status(500).json({ success: false, message: "Failed to list maintenance schedules" });
  }
};

const createSchedule = async (req, res) => {
  try {
    const { asset_id, maintenance_type, scheduled_date, priority, status } = req.body;
    if (!asset_id || !maintenance_type || !scheduled_date) {
      return res.status(400).json({
        success: false,
        message: "asset_id, maintenance_type and scheduled_date are required",
      });
    }
    const result = await pool.query(
      `INSERT INTO maintenance_schedules (asset_id, maintenance_type, scheduled_date, priority, status)
       VALUES ($1, $2, $3, COALESCE($4, 'MEDIUM'), COALESCE($5, 'PENDING')) RETURNING *`,
      [asset_id, maintenance_type, scheduled_date, priority, status]
    );

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "MAINTENANCE_SCHEDULE_CREATED",
      entityType: "MAINTENANCE_SCHEDULE",
      entityId: result.rows[0].id,
      newData: result.rows[0],
    });

    res.status(201).json({ success: true, message: "Schedule created", data: result.rows[0] });
  } catch (error) {
    console.error("❌ Failed to create schedule:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to create schedule" });
  }
};

// ---------------------------------------------------------------------
// WORK ORDERS
// ---------------------------------------------------------------------
const getWorkOrders = async (req, res) => {
  try {
    const orgId = isCustomerRole(req.user.role) ? req.user.organizationId : (req.query.organizationId || null);
    const result = await pool.query(
      `SELECT wo.*, a.asset_code, a.name AS asset_name,
              assignee.name AS assigned_to_name, creator.name AS created_by_name
       FROM work_orders wo
       JOIN assets a ON wo.asset_id = a.id
       LEFT JOIN coaches c ON a.coach_id = c.id
       LEFT JOIN trains t ON c.train_id = t.id
       LEFT JOIN projects pj ON t.project_id = pj.id
       LEFT JOIN users assignee ON wo.assigned_to = assignee.id
       LEFT JOIN users creator ON wo.created_by = creator.id
       WHERE ($1::int IS NULL OR pj.organization_id = $1)
       ORDER BY wo.created_at DESC`,
      [orgId]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("❌ Failed to list work orders:", error.message);
    res.status(500).json({ success: false, message: "Failed to list work orders" });
  }
};

const createWorkOrder = async (req, res) => {
  try {
    await ensureMaintenanceSchema();

    const {
      asset_id,
      title,
      description,
      priority,
      status,
      assigned_to,
      alert_id,
      service_request_id,
    } = req.body;

    if (!asset_id || !title) {
      return res.status(400).json({ success: false, message: "asset_id and title are required" });
    }

    const finalStatus = assigned_to ? (status || "ASSIGNED") : (status || "OPEN");

    const result = await pool.query(
      `INSERT INTO work_orders (
         asset_id, title, description, priority, status, assigned_to,
         created_by, alert_id, service_request_id
       )
       VALUES ($1, $2, $3, COALESCE($4, 'MEDIUM'), $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        asset_id,
        title,
        description || null,
        priority,
        finalStatus,
        assigned_to || null,
        req.user.id,
        alert_id || null,
        service_request_id || null,
      ]
    );

    const workOrder = result.rows[0];

    // If created from a service request, transition service request to ASSIGNED/IN_PROGRESS and link work_order_id
    if (service_request_id) {
      await pool.query(
        "UPDATE service_requests SET status = 'IN_PROGRESS', work_order_id = $1 WHERE id = $2",
        [workOrder.id, service_request_id]
      );
    }

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "WORK_ORDER_CREATED",
      entityType: "WORK_ORDER",
      entityId: workOrder.id,
      newData: workOrder,
    });

    res.status(201).json({ success: true, message: "Work order created", data: workOrder });
  } catch (error) {
    console.error("❌ Failed to create work order:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to create work order" });
  }
};

const updateWorkOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const workOrderId = Number(req.params.id);

    if (!VALID_WORK_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${VALID_WORK_ORDER_STATUSES.join(", ")}`,
      });
    }

    const currentResult = await pool.query("SELECT * FROM work_orders WHERE id = $1", [workOrderId]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Work order not found" });
    }

    const current = currentResult.rows[0];
    const isCompleted = status === "COMPLETED" || status === "CLOSED";

    const result = await pool.query(
      `UPDATE work_orders
       SET status = $1::varchar,
           completed_at = CASE WHEN $2::boolean THEN COALESCE(completed_at, NOW()) ELSE completed_at END,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, isCompleted, workOrderId]
    );

    const updated = result.rows[0];

    // If work order resolved/closed and came from a service request, mark service request resolved
    if (isCompleted && updated.service_request_id) {
      await pool.query(
        "UPDATE service_requests SET status = 'RESOLVED', resolved_at = COALESCE(resolved_at, NOW()), updated_at = NOW() WHERE id = $1",
        [updated.service_request_id]
      );
    }

    await auditModel.logAction({
      userId: req.user?.id || null,
      organizationId: req.user?.organizationId || null,
      action: "WORK_ORDER_STATUS_CHANGED",
      entityType: "WORK_ORDER",
      entityId: workOrderId,
      oldData: { status: current.status },
      newData: { status: updated.status },
    });

    res.status(200).json({ success: true, message: "Status updated", data: updated });
  } catch (error) {
    console.error("❌ Failed to update work order status:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to update work order status" });
  }
};

// ---------------------------------------------------------------------
// WORK ORDER PARTS CONSUMPTION & INVENTORY LINK
// ---------------------------------------------------------------------
const useWorkOrderPart = async (req, res) => {
  const client = await pool.connect();
  try {
    const workOrderId = Number(req.params.id);
    const { part_id, quantity } = req.body;
    const qty = Number(quantity);

    if (!part_id || !qty || qty <= 0) {
      return res.status(400).json({ success: false, message: "Valid part_id and positive quantity are required" });
    }

    await client.query("BEGIN");

    // Check inventory stock
    const invRes = await client.query(
      "SELECT * FROM inventory WHERE part_id = $1 AND quantity >= $2 ORDER BY quantity DESC LIMIT 1 FOR UPDATE",
      [part_id, qty]
    );
    const inv = invRes.rows[0];
    if (!inv) {
      const totalRes = await client.query(
        "SELECT COALESCE(SUM(quantity), 0)::int AS total FROM inventory WHERE part_id = $1",
        [part_id]
      );
      const available = totalRes.rows[0]?.total || 0;
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Insufficient inventory. Available: ${available}, requested: ${qty}`,
      });
    }

    // 1. Deduct stock from inventory location
    await client.query("UPDATE inventory SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2", [
      qty,
      inv.id,
    ]);

    // 2. Record stock transaction OUT / USED
    await client.query(
      `INSERT INTO stock_transactions (part_id, inventory_id, transaction_type, quantity, reference_type, reference_id)
       VALUES ($1, $2, 'USED', $3, 'work_order', $4)`,
      [part_id, inv.id, -qty, workOrderId]
    );

    // 3. Link part to work order
    const woPartRes = await client.query(
      `INSERT INTO work_order_parts (work_order_id, part_id, quantity)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [workOrderId, part_id, qty]
    );

    await client.query("COMMIT");

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "INVENTORY_PART_CONSUMED",
      entityType: "WORK_ORDER_PART",
      entityId: workOrderId,
      newData: { part_id, quantity: qty },
    });

    res.status(200).json({
      success: true,
      message: "Part successfully issued from inventory to work order",
      data: woPartRes.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to consume work order part:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to consume work order part" });
  } finally {
    client.release();
  }
};

const getWorkOrderParts = async (req, res) => {
  try {
    const workOrderId = Number(req.params.id);
    const result = await pool.query(
      `SELECT wop.*, p.part_code, p.name AS part_name, p.unit AS unit_of_measure
       FROM work_order_parts wop
       JOIN parts p ON wop.part_id = p.id
       WHERE wop.work_order_id = $1
       ORDER BY wop.created_at ASC`,
      [workOrderId]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("❌ Failed to list work order parts:", error.message);
    res.status(500).json({ success: false, message: "Failed to list work order parts" });
  }
};

module.exports = {
  getSchedules,
  createSchedule,
  getWorkOrders,
  createWorkOrder,
  updateWorkOrderStatus,
  useWorkOrderPart,
  getWorkOrderParts,
};
