const pool = require("../config/db");
const { isCustomerRole } = require("../middleware/roles");
const auditModel = require("../models/auditModel");

// GET /api/service-requests
const getServiceRequests = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sr.*, a.asset_code, a.name AS asset_name, u.name AS created_by_name
       FROM service_requests sr
       JOIN assets a ON sr.asset_id = a.id
       LEFT JOIN users u ON sr.created_by = u.id
       ORDER BY sr.created_at DESC`
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("❌ Failed to list service requests:", error.message);
    res.status(500).json({ success: false, message: "Failed to list service requests" });
  }
};

// POST /api/service-requests
const createServiceRequest = async (req, res) => {
  try {
    const { asset_id, title, description, priority } = req.body;
    if (!asset_id || !title) {
      return res.status(400).json({ success: false, message: "asset_id and title are required" });
    }

    const result = await pool.query(
      `INSERT INTO service_requests (asset_id, created_by, title, description, priority, status)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'MEDIUM'), 'OPEN') RETURNING *`,
      [asset_id, req.user.id, title, description, priority]
    );

    const sr = result.rows[0];

    await auditModel.logAction({
      userId: req.user.id,
      action: "SERVICE_REQUEST_CREATED",
      entityType: "SERVICE_REQUEST",
      entityId: sr.id,
      newData: sr,
    });

    res.status(201).json({ success: true, message: "Service request submitted", data: sr });
  } catch (error) {
    console.error("❌ Failed to create service request:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to create service request" });
  }
};

const SR_STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"];

// PATCH /api/service-requests/:id/status
const updateServiceRequestStatus = async (req, res) => {
  try {
    const { status, work_order_id } = req.body;
    if (!status || !SR_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${SR_STATUSES.join(", ")}` });
    }
    const resolvedAtClause = status === "RESOLVED" || status === "CLOSED" ? "NOW()" : "resolved_at";
    const result = await pool.query(
      `UPDATE service_requests
       SET status = $1, work_order_id = COALESCE($2, work_order_id), resolved_at = ${resolvedAtClause}
       WHERE id = $3 RETURNING *`,
      [status, work_order_id || null, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Service request not found" });
    }

    const updated = result.rows[0];

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "SERVICE_REQUEST_STATUS_CHANGED",
      entityType: "SERVICE_REQUEST",
      entityId: updated.id,
      newData: { status },
    });

    res.status(200).json({ success: true, message: "Status updated", data: updated });
  } catch (error) {
    console.error("❌ Failed to update service request:", error.message);
    res.status(500).json({ success: false, message: "Failed to update service request" });
  }
};

module.exports = { getServiceRequests, createServiceRequest, updateServiceRequestStatus };
