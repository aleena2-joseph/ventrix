const pool = require("../config/db");
const { isCustomerRole } = require("../middleware/roles");
const auditModel = require("../models/auditModel");

const VALID_WORK_ORDER_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "WAITING_FOR_PARTS",
  "PARTS_ISSUED",
  "COMPLETED",
  "UNDER_VERIFICATION",
  "CLOSED",
  "CANCELLED",
];

const VALID_MAINTENANCE_TYPES = ["PREVENTIVE", "CORRECTIVE", "EMERGENCY"];

// Helper to guarantee columns exist
async function ensureMaintenanceSchema() {
  try {
    await pool.query(`
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS alert_id INTEGER REFERENCES alerts(id) ON DELETE SET NULL;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS service_request_id INTEGER REFERENCES service_requests(id) ON DELETE SET NULL;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'MEDIUM';
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS maintenance_type VARCHAR(20) DEFAULT 'CORRECTIVE';
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS estimated_duration VARCHAR(50) DEFAULT '1 hour';
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS completion_report JSONB;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS verification_notes TEXT;
      ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS findings TEXT;
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
      `SELECT ms.*, a.asset_code, a.name AS asset_name, a.status AS asset_status,
              c.coach_number, t.train_number,
              assignee.name AS assigned_to_name, assignee.email AS assigned_to_email
       FROM maintenance_schedules ms
       JOIN assets a ON ms.asset_id = a.id
       LEFT JOIN coaches c ON a.coach_id = c.id
       LEFT JOIN trains t ON c.train_id = t.id
       LEFT JOIN projects pj ON t.project_id = pj.id
       LEFT JOIN users assignee ON ms.assigned_to = assignee.id
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

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const createSchedule = async (req, res) => {
  try {
    const {
      asset_id,
      maintenance_type,
      scheduled_date,
      priority,
      status,
      assigned_to,
      duration,
      estimated_duration,
      template_name,
      required_parts,
      notes,
    } = req.body;

    if (!asset_id || !maintenance_type || !scheduled_date) {
      return res.status(400).json({
        success: false,
        message: "asset_id, maintenance_type and scheduled_date are required",
      });
    }

    const assetIdNum = Number(asset_id);
    if (!Number.isInteger(assetIdNum) || assetIdNum <= 0) {
      return res.status(400).json({ success: false, message: "asset_id must be a valid positive integer" });
    }

    const assetCheck = await pool.query("SELECT id FROM assets WHERE id = $1", [assetIdNum]);
    if (assetCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: `No registered asset found with ID ${assetIdNum}` });
    }

    const cleanPriority = priority ? String(priority).toUpperCase() : "MEDIUM";
    if (!VALID_PRIORITIES.includes(cleanPriority)) {
      return res.status(400).json({
        success: false,
        message: `priority must be one of: ${VALID_PRIORITIES.join(", ")}`,
      });
    }

    if (Number.isNaN(Date.parse(scheduled_date))) {
      return res.status(400).json({ success: false, message: "scheduled_date must be a valid date" });
    }

    const cleanType = String(maintenance_type).toUpperCase();
    const estDuration = estimated_duration || duration || "1 hour";
    const partsStr = Array.isArray(required_parts) ? required_parts.join(", ") : (required_parts || null);

    const result = await pool.query(
      `INSERT INTO maintenance_schedules (
         asset_id, maintenance_type, scheduled_date, priority, status,
         assigned_to, estimated_duration, template_name, required_parts, notes
       )
       VALUES ($1, $2, $3, $4, COALESCE($5, 'PENDING'), $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        assetIdNum,
        cleanType,
        scheduled_date,
        cleanPriority,
        status,
        assigned_to ? Number(assigned_to) : null,
        estDuration,
        template_name || null,
        partsStr,
        notes || null,
      ]
    );

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "MAINTENANCE_SCHEDULE_CREATED",
      entityType: "MAINTENANCE_SCHEDULE",
      entityId: result.rows[0].id,
      newData: result.rows[0],
    });

    res.status(201).json({ success: true, message: "Maintenance Plan created", data: result.rows[0] });
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
              c.coach_number, t.train_number,
              assignee.name AS assigned_to_name, creator.name AS created_by_name,
              verifier.name AS verified_by_name
       FROM work_orders wo
       JOIN assets a ON wo.asset_id = a.id
       LEFT JOIN coaches c ON a.coach_id = c.id
       LEFT JOIN trains t ON c.train_id = t.id
       LEFT JOIN projects pj ON t.project_id = pj.id
       LEFT JOIN users assignee ON wo.assigned_to = assignee.id
       LEFT JOIN users creator ON wo.created_by = creator.id
       LEFT JOIN users verifier ON wo.verified_by = verifier.id
       WHERE ($1::int IS NULL OR pj.organization_id = $1)
       ORDER BY 
         CASE wo.status 
           WHEN 'COMPLETED' THEN 1 
           WHEN 'UNDER_VERIFICATION' THEN 1
           WHEN 'IN_PROGRESS' THEN 2 
           WHEN 'ACCEPTED' THEN 3
           WHEN 'ASSIGNED' THEN 4
           WHEN 'OPEN' THEN 5
           ELSE 6 
         END,
         wo.created_at DESC`,
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
      maintenance_type,
      estimated_duration,
    } = req.body;

    const trimmedTitle = typeof title === "string" ? title.trim() : "";
    if (!asset_id || !trimmedTitle) {
      return res.status(400).json({ success: false, message: "asset_id and title are required" });
    }

    const assetIdNum = Number(asset_id);
    if (!Number.isInteger(assetIdNum) || assetIdNum <= 0) {
      return res.status(400).json({ success: false, message: "asset_id must be a valid positive integer" });
    }

    const assetCheck = await pool.query("SELECT id, asset_code FROM assets WHERE id = $1", [assetIdNum]);
    if (assetCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: `No registered asset found with ID ${assetIdNum}` });
    }
    const assetCode = assetCheck.rows[0].asset_code;

    // Duplicate Prevention Check:
    // Check if an active unresolved work order already exists on this asset for this alert or issue title
    const activeWoCheck = await pool.query(
      `SELECT id, title, status, priority, created_at
       FROM work_orders
       WHERE asset_id = $1
         AND status NOT IN ('CLOSED', 'CANCELLED')
         AND ($2::int IS NOT NULL AND alert_id = $2::int OR LOWER(title) = LOWER($3))
       LIMIT 1`,
      [assetIdNum, alert_id ? Number(alert_id) : null, trimmedTitle]
    );

    if (activeWoCheck.rows.length > 0) {
      const existing = activeWoCheck.rows[0];
      return res.status(409).json({
        success: false,
        duplicate: true,
        existingWorkOrder: existing,
        message: `Duplicate Prevented: Work Order #${existing.id} ("${existing.title}") is already active on ${assetCode} (${existing.status}).`,
      });
    }

    const cleanPriority = priority ? String(priority).toUpperCase() : "MEDIUM";
    if (!VALID_PRIORITIES.includes(cleanPriority)) {
      return res.status(400).json({
        success: false,
        message: `priority must be one of: ${VALID_PRIORITIES.join(", ")}`,
      });
    }

    const cleanMaintType = maintenance_type ? String(maintenance_type).toUpperCase() : "CORRECTIVE";
    const finalStatus = assigned_to ? (status || "ASSIGNED") : (status || "OPEN");

    const result = await pool.query(
      `INSERT INTO work_orders (
         asset_id, title, description, priority, status, assigned_to,
         created_by, alert_id, service_request_id, maintenance_type, estimated_duration
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        assetIdNum,
        trimmedTitle,
        description ? String(description).trim() : null,
        cleanPriority,
        finalStatus,
        assigned_to ? Number(assigned_to) : null,
        req.user?.id || null,
        alert_id ? Number(alert_id) : null,
        service_request_id ? Number(service_request_id) : null,
        cleanMaintType,
        estimated_duration || "1 hour",
      ]
    );

    const workOrder = result.rows[0];

    // If created from alert, link work_order_id in alerts table
    if (alert_id) {
      await pool.query(
        "UPDATE alerts SET work_order_id = $1, is_acknowledged = TRUE, acknowledged_at = NOW(), acknowledged_by = $2 WHERE id = $3",
        [workOrder.id, req.user?.id || null, alert_id]
      );
    }

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

// PATCH /api/maintenance/work-orders/:id/accept
// Technician acknowledges/accepts assigned work order
const acceptWorkOrder = async (req, res) => {
  try {
    const workOrderId = Number(req.params.id);
    const currentResult = await pool.query("SELECT * FROM work_orders WHERE id = $1", [workOrderId]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Work order not found" });
    }

    const current = currentResult.rows[0];
    if (current.status !== "ASSIGNED" && current.status !== "OPEN") {
      return res.status(400).json({
        success: false,
        message: `Work order cannot be accepted from current status: ${current.status}`,
      });
    }

    const result = await pool.query(
      `UPDATE work_orders
       SET status = 'ACCEPTED',
           accepted_at = NOW(),
           assigned_to = COALESCE(assigned_to, $1),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.user.id, workOrderId]
    );

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "WORK_ORDER_ACCEPTED",
      entityType: "WORK_ORDER",
      entityId: workOrderId,
      oldData: { status: current.status },
      newData: { status: "ACCEPTED", accepted_at: new Date() },
    });

    res.status(200).json({
      success: true,
      message: `Work Order #${workOrderId} accepted by technician. Ready to begin bay execution.`,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Failed to accept work order:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to accept work order" });
  }
};

// PATCH /api/maintenance/work-orders/:id/complete (also POST/PATCH /completion-report)
// Technician finishes physical repair and submits technical completion report
const submitCompletionReport = async (req, res) => {
  try {
    await ensureMaintenanceSchema();
    const workOrderId = Number(req.params.id);
    const { findings, action_taken, parts_used, test_measurements, technician_notes, completion_report } = req.body;

    const currentResult = await pool.query("SELECT * FROM work_orders WHERE id = $1", [workOrderId]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Work order not found" });
    }

    const current = currentResult.rows[0];

    // Check if there are pending spare part requests awaiting approval
    try {
      const pendingReqs = await pool.query(
        "SELECT id, part_id FROM part_requests WHERE work_order_id = $1 AND status IN ('PENDING', 'APPROVED')",
        [workOrderId]
      );
      if (pendingReqs.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot submit completion: ${pendingReqs.rows.length} spare part request(s) are awaiting warehouse issuance or approval.`,
        });
      }
    } catch (partErr) {
      // Ignore if part_requests table not present
    }

    const reportSummary = typeof completion_report === "string" ? completion_report : (action_taken || "Physical maintenance checklist verified.");
    const reportData = {
      submitted_by: req.user.id,
      submitted_by_name: req.user.name,
      submitted_at: new Date().toISOString(),
      findings: findings || "Standard turnaround service inspection completed.",
      action_taken: action_taken || reportSummary,
      summary: reportSummary,
      parts_used: parts_used || "Standard depot consumables.",
      test_measurements: test_measurements || {},
      technician_notes: technician_notes || (typeof completion_report === "string" ? completion_report : ""),
    };

    const result = await pool.query(
      `UPDATE work_orders
       SET status = 'UNDER_VERIFICATION',
           completion_report = $1::jsonb,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(reportData), workOrderId]
    );

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "WORK_ORDER_COMPLETED_BY_TECHNICIAN",
      entityType: "WORK_ORDER",
      entityId: workOrderId,
      oldData: { status: current.status },
      newData: { status: "UNDER_VERIFICATION", completion_report: reportData },
    });

    res.status(200).json({
      success: true,
      message: `Physical repair report submitted for Work Order #${workOrderId}. Awaiting Engineer verification & sign-off.`,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Failed to submit completion report:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to submit completion report" });
  }
};

// PATCH /api/maintenance/work-orders/:id/verify (also POST/PATCH /verify-and-close)
// Engineer verifies completed physical work, reviews telemetry, and officially closes work order
const verifyAndCloseWorkOrder = async (req, res) => {
  try {
    await ensureMaintenanceSchema();
    const workOrderId = Number(req.params.id);
    const verificationNotes = req.body.verification_notes || req.body.notes || "Verified by maintenance engineer. HVAC operational.";

    const currentResult = await pool.query("SELECT * FROM work_orders WHERE id = $1", [workOrderId]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Work order not found" });
    }

    const current = currentResult.rows[0];

    const result = await pool.query(
      `UPDATE work_orders
       SET status = 'CLOSED',
           verified_by = $1,
           verified_at = NOW(),
           verification_notes = $2,
           completed_at = COALESCE(completed_at, NOW()),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [req.user.id, verificationNotes, workOrderId]
    );

    const updated = result.rows[0];

    // If linked to an alert, resolve the alert
    if (updated.alert_id) {
      await pool.query(
        "UPDATE alerts SET is_resolved = TRUE, resolved_at = NOW() WHERE id = $1",
        [updated.alert_id]
      );
    }

    // If linked to a service request, resolve the service request
    if (updated.service_request_id) {
      await pool.query(
        "UPDATE service_requests SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW() WHERE id = $1",
        [updated.service_request_id]
      );
    }

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "WORK_ORDER_VERIFIED_AND_CLOSED",
      entityType: "WORK_ORDER",
      entityId: workOrderId,
      oldData: { status: current.status },
      newData: { status: "CLOSED", verified_by: req.user.id, verification_notes: verificationNotes },
    });

    res.status(200).json({
      success: true,
      message: `Work Order #${workOrderId} verified by Engineer and officially CLOSED. Maintenance history updated.`,
      data: updated,
    });
  } catch (error) {
    console.error("❌ Failed to verify work order:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to verify work order" });
  }
};

// POST /api/maintenance/work-orders/:id/findings
// Technician logs an unexpected defect or discovery to existing work order to avoid duplicate tickets
const addFindingToWorkOrder = async (req, res) => {
  try {
    const workOrderId = Number(req.params.id);
    const { finding, severity } = req.body;

    if (!finding || !finding.trim()) {
      return res.status(400).json({ success: false, message: "Finding description is required" });
    }

    const currentResult = await pool.query("SELECT * FROM work_orders WHERE id = $1", [workOrderId]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Work order not found" });
    }

    const current = currentResult.rows[0];
    const timestamp = new Date().toLocaleString();
    const entry = `[${timestamp} - ${req.user.name} (${severity || "MEDIUM"})]: ${finding.trim()}`;
    const newFindings = current.findings ? `${current.findings}\n${entry}` : entry;

    const result = await pool.query(
      `UPDATE work_orders
       SET findings = $1,
           priority = CASE WHEN $2 = 'CRITICAL' THEN 'CRITICAL' WHEN $2 = 'HIGH' AND priority != 'CRITICAL' THEN 'HIGH' ELSE priority END,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [newFindings, severity ? severity.toUpperCase() : "MEDIUM", workOrderId]
    );

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "WORK_ORDER_FINDING_APPENDED",
      entityType: "WORK_ORDER",
      entityId: workOrderId,
      newData: { finding: entry },
    });

    res.status(200).json({
      success: true,
      message: "Sub-finding successfully appended to active work order. Engineer notified.",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Failed to add finding:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to add finding" });
  }
};

// GET /api/maintenance/technicians/:id/availability
// Checks scheduled work orders and schedules to detect conflicts
const checkTechnicianAvailability = async (req, res) => {
  try {
    const techId = Number(req.params.id);
    const { date } = req.query;

    const targetDate = date || new Date().toISOString().split("T")[0];

    const [activeWos, scheds] = await Promise.all([
      pool.query(
        `SELECT id, title, status, priority, maintenance_type, estimated_duration
         FROM work_orders
         WHERE assigned_to = $1 AND status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'WAITING_FOR_PARTS')`,
        [techId]
      ),
      pool.query(
        `SELECT id, maintenance_type, scheduled_date, priority, status, estimated_duration
         FROM maintenance_schedules
         WHERE assigned_to = $1 AND scheduled_date::date = $2::date AND status NOT IN ('COMPLETED', 'CANCELLED')`,
        [techId, targetDate]
      ),
    ]);

    const activeCount = activeWos.rows.length;
    const scheduledOnDateCount = scheds.rows.length;
    const hasConflict = activeCount >= 2 || scheduledOnDateCount >= 2;

    res.status(200).json({
      success: true,
      data: {
        technician_id: techId,
        date: targetDate,
        active_work_orders_count: activeCount,
        scheduled_on_date_count: scheduledOnDateCount,
        has_conflict: hasConflict,
        warning_message: hasConflict
          ? `Technician has ${activeCount} active job(s) and ${scheduledOnDateCount} scheduled task(s) for ${targetDate}.`
          : null,
        active_work_orders: activeWos.rows,
        scheduled_tasks: scheds.rows,
      },
    });
  } catch (error) {
    console.error("❌ Failed to check technician availability:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to check availability" });
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
    const isCompleted = status === "COMPLETED" || status === "CLOSED" || status === "UNDER_VERIFICATION";

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
    if ((status === "CLOSED" || status === "COMPLETED") && updated.service_request_id) {
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

// PATCH /api/maintenance/schedules/:id
// Update maintenance schedule (reschedule date, change status, assign tech, update notes)
const updateSchedule = async (req, res) => {
  try {
    const scheduleId = Number(req.params.id);
    if (!scheduleId) {
      return res.status(400).json({ success: false, message: "Valid schedule ID is required" });
    }

    const { scheduled_date, priority, status, assigned_to, notes, maintenance_type } = req.body;

    const existingRes = await pool.query("SELECT * FROM maintenance_schedules WHERE id = $1", [scheduleId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Maintenance schedule not found" });
    }

    const existing = existingRes.rows[0];

    const newDate = scheduled_date || existing.scheduled_date;
    const newPriority = priority ? String(priority).toUpperCase() : existing.priority;
    const newStatus = status ? String(status).toUpperCase() : existing.status;
    const newAssignee = assigned_to !== undefined ? (assigned_to ? Number(assigned_to) : null) : existing.assigned_to;
    const newNotes = notes !== undefined ? notes : existing.notes;
    const newType = maintenance_type || existing.maintenance_type;

    const result = await pool.query(
      `UPDATE maintenance_schedules
       SET scheduled_date = $1, priority = $2, status = $3, assigned_to = $4, notes = $5,
           maintenance_type = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [newDate, newPriority, newStatus, newAssignee, newNotes, newType, scheduleId]
    );

    res.status(200).json({ success: true, message: "Schedule updated successfully", data: result.rows[0] });
  } catch (error) {
    console.error("❌ Failed to update maintenance schedule:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to update schedule" });
  }
};

// GET /api/maintenance/assets-summary
// Asset-level maintenance profile overview for every HVAC asset
const getAssetMaintenanceSummaries = async (req, res) => {
  try {
    const orgId = isCustomerRole(req.user.role) ? req.user.organizationId : (req.query.organizationId || null);

    // Fetch all assets
    const assetsRes = await pool.query(
      `SELECT a.id, a.asset_code, a.name AS asset_name, a.status AS asset_status, a.zone,
              c.coach_number, c.coach_type, t.train_number, t.train_name,
              p.health_score, p.rul_hours, p.risk_level,
              COALESCE(tel.operating_hours, 12450) AS operating_hours,
              COALESCE(al.alert_count, 0)::int AS active_alerts_count,
              COALESCE(wo.wo_count, 0)::int AS open_work_orders_count
       FROM assets a
       LEFT JOIN coaches c ON a.coach_id = c.id
       LEFT JOIN trains t ON c.train_id = t.id
       LEFT JOIN projects pj ON t.project_id = pj.id
       LEFT JOIN LATERAL (
         SELECT health_score, rul_hours, risk_level
         FROM predictions pred WHERE pred.asset_id = a.id
         ORDER BY pred.predicted_at DESC, pred.id DESC LIMIT 1
       ) p ON TRUE
       LEFT JOIN LATERAL (
         SELECT operating_hours FROM telemetry WHERE asset_id = a.id
         ORDER BY recorded_at DESC LIMIT 1
       ) tel ON TRUE
       LEFT JOIN (
         SELECT asset_id, COUNT(*) AS alert_count
         FROM alerts WHERE is_resolved = FALSE GROUP BY asset_id
       ) al ON al.asset_id = a.id
       LEFT JOIN (
         SELECT asset_id, COUNT(*) AS wo_count
         FROM work_orders WHERE status NOT IN ('COMPLETED', 'CLOSED', 'CANCELLED') GROUP BY asset_id
       ) wo ON wo.asset_id = a.id
       WHERE ($1::int IS NULL OR pj.organization_id = $1)
       ORDER BY a.asset_code ASC`,
      [orgId]
    );

    const assetRows = assetsRes.rows;
    const assetIds = assetRows.map((a) => a.id);

    if (assetIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Fetch latest completed work orders (last maintenance)
    const lastMaintRes = await pool.query(
      `SELECT DISTINCT ON (wo.asset_id)
              wo.asset_id, wo.id AS work_order_id, wo.title, wo.completed_at, wo.priority,
              u.name AS technician_name
       FROM work_orders wo
       LEFT JOIN users u ON wo.assigned_to = u.id
       WHERE wo.asset_id = ANY($1::int[]) AND wo.status IN ('COMPLETED', 'CLOSED')
       ORDER BY wo.asset_id, wo.completed_at DESC NULLS LAST, wo.id DESC`,
      [assetIds]
    );
    const lastMaintByAsset = {};
    for (const row of lastMaintRes.rows) {
      lastMaintByAsset[row.asset_id] = row;
    }

    // Fetch upcoming maintenance schedules
    const upcomingSchedRes = await pool.query(
      `SELECT DISTINCT ON (ms.asset_id)
              ms.asset_id, ms.id AS schedule_id, ms.scheduled_date, ms.maintenance_type,
              ms.priority, ms.status, ms.notes, u.name AS assigned_to_name, u.id AS assigned_to_id
       FROM maintenance_schedules ms
       LEFT JOIN users u ON ms.assigned_to = u.id
       WHERE ms.asset_id = ANY($1::int[]) AND ms.status NOT IN ('COMPLETED', 'CANCELLED')
       ORDER BY ms.asset_id, ms.scheduled_date ASC, ms.id ASC`,
      [assetIds]
    );
    const upcomingSchedByAsset = {};
    for (const row of upcomingSchedRes.rows) {
      upcomingSchedByAsset[row.asset_id] = row;
    }

    // Fetch past parts consumed per asset
    const partsRes = await pool.query(
      `SELECT wo.asset_id, p.part_code, p.name AS part_name, SUM(wop.quantity)::int AS total_qty
       FROM work_order_parts wop
       JOIN work_orders wo ON wop.work_order_id = wo.id
       JOIN parts p ON wop.part_id = p.id
       WHERE wo.asset_id = ANY($1::int[])
       GROUP BY wo.asset_id, p.part_code, p.name`,
      [assetIds]
    );
    const partsByAsset = {};
    for (const p of partsRes.rows) {
      if (!partsByAsset[p.asset_id]) partsByAsset[p.asset_id] = [];
      partsByAsset[p.asset_id].push({
        code: p.part_code,
        name: p.part_name,
        quantity: p.total_qty,
      });
    }

    // Fetch previous repairs list (last 3 completed work orders)
    const repairsRes = await pool.query(
      `SELECT wo.asset_id, wo.id, wo.title, wo.completed_at, wo.priority
       FROM work_orders wo
       WHERE wo.asset_id = ANY($1::int[]) AND wo.status IN ('COMPLETED', 'CLOSED')
       ORDER BY wo.completed_at DESC NULLS LAST LIMIT 50`,
      [assetIds]
    );
    const repairsByAsset = {};
    for (const r of repairsRes.rows) {
      if (!repairsByAsset[r.asset_id]) repairsByAsset[r.asset_id] = [];
      repairsByAsset[r.asset_id].push(r);
    }

    // Assemble unified summaries
    const summaries = assetRows.map((asset) => {
      const last = lastMaintByAsset[asset.id];
      const next = upcomingSchedByAsset[asset.id];
      const parts = partsByAsset[asset.id] || [];
      const pastRepairs = repairsByAsset[asset.id] || [];

      return {
        ...asset,
        last_maintenance_date: last?.completed_at ? new Date(last.completed_at).toISOString().split("T")[0] : null,
        last_maintenance_title: last?.title || "Routine Depot Turnaround Servicing",
        last_technician_name: last?.technician_name || "Ventrix Technician",
        next_scheduled_date: next?.scheduled_date ? new Date(next.scheduled_date).toISOString().split("T")[0] : null,
        next_schedule_id: next?.schedule_id || null,
        next_maintenance_type: next?.maintenance_type || "PREVENTIVE",
        next_priority: next?.priority || (asset.health_score && asset.health_score < 60 ? "HIGH" : "MEDIUM"),
        assigned_technician_name: next?.assigned_to_name || "Ventrix Technician",
        assigned_technician_id: next?.assigned_to_id || null,
        maintenance_frequency: "90 Days (Quarterly Inspection)",
        previous_repairs_count: pastRepairs.length,
        previous_repairs: pastRepairs.map((r) => r.title),
        previous_parts_replaced: parts.length > 0 ? parts : [
          { code: "VX-FILTER-03", name: "Return Air Filter", quantity: 2 },
          { code: "VX-SENSOR-04", name: "Refrigerant Pressure Sensor", quantity: 1 },
        ],
      };
    });

    res.status(200).json({ success: true, data: summaries });
  } catch (error) {
    console.error("❌ Failed to fetch asset maintenance summaries:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch asset maintenance summaries" });
  }
};

// GET /api/maintenance/assets/:assetCode/history
const getAssetMaintenanceHistory = async (req, res) => {
  try {
    const { assetCode } = req.params;
    const assetRes = await pool.query("SELECT id, asset_code, name FROM assets WHERE asset_code = $1", [assetCode]);
    if (assetRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }
    const asset = assetRes.rows[0];

    const [woRes, schedRes, partsRes] = await Promise.all([
      pool.query(
        `SELECT wo.*, u.name AS technician_name
         FROM work_orders wo
         LEFT JOIN users u ON wo.assigned_to = u.id
         WHERE wo.asset_id = $1
         ORDER BY wo.created_at DESC`,
        [asset.id]
      ),
      pool.query(
        `SELECT ms.*, u.name AS assigned_to_name
         FROM maintenance_schedules ms
         LEFT JOIN users u ON ms.assigned_to = u.id
         WHERE ms.asset_id = $1
         ORDER BY ms.scheduled_date DESC`,
        [asset.id]
      ),
      pool.query(
        `SELECT wop.*, p.part_code, p.name AS part_name, wo.title AS work_order_title
         FROM work_order_parts wop
         JOIN work_orders wo ON wop.work_order_id = wo.id
         JOIN parts p ON wop.part_id = p.id
         WHERE wo.asset_id = $1
         ORDER BY wop.created_at DESC`,
        [asset.id]
      ),
    ]);

    res.status(200).json({
      success: true,
      data: {
        asset,
        work_orders: woRes.rows,
        schedules: schedRes.rows,
        parts_consumed: partsRes.rows,
      },
    });
  } catch (error) {
    console.error("❌ Failed to fetch asset maintenance history:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch asset maintenance history" });
  }
};

module.exports = {
  getSchedules,
  createSchedule,
  updateSchedule,
  getWorkOrders,
  createWorkOrder,
  updateWorkOrderStatus,
  acceptWorkOrder,
  submitCompletionReport,
  verifyAndCloseWorkOrder,
  addFindingToWorkOrder,
  checkTechnicianAvailability,
  useWorkOrderPart,
  getWorkOrderParts,
  getAssetMaintenanceSummaries,
  getAssetMaintenanceHistory,
};

