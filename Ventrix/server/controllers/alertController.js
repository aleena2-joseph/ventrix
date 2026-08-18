const pool = require("../config/db");
const { isCustomerRole } = require("../middleware/roles");
const auditModel = require("../models/auditModel");

// GET /api/alerts — org-scoped for customer roles; optional
// ?resolved=true|false filter for everyone.
const getAlerts = async (req, res) => {
  try {
    const orgId = isCustomerRole(req.user.role) ? req.user.organizationId : (req.query.organizationId || null);
    const resolvedFilter = req.query.resolved === undefined ? null : req.query.resolved === "true";

    const result = await pool.query(
      `SELECT al.*, a.asset_code, a.name AS asset_name
       FROM alerts al
       JOIN assets a ON al.asset_id = a.id
       LEFT JOIN coaches c ON a.coach_id = c.id
       LEFT JOIN trains t ON c.train_id = t.id
       LEFT JOIN projects pj ON t.project_id = pj.id
       WHERE ($1::int IS NULL OR pj.organization_id = $1)
         AND ($2::boolean IS NULL OR al.is_resolved = $2)
       ORDER BY al.created_at DESC
       LIMIT 200`,
      [orgId, resolvedFilter]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("❌ Failed to list alerts:", error.message);
    res.status(500).json({ success: false, message: "Failed to list alerts" });
  }
};

// POST /api/alerts
const createAlert = async (req, res) => {
  try {
    const { asset_id, level, title, message, source } = req.body;
    if (!asset_id || !level || !title) {
      return res.status(400).json({ success: false, message: "asset_id, level and title are required" });
    }
    const result = await pool.query(
      `INSERT INTO alerts (asset_id, level, title, message, source)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'rule')) RETURNING *`,
      [asset_id, level, title, message, source]
    );
    res.status(201).json({ success: true, message: "Alert created", data: result.rows[0] });
  } catch (error) {
    console.error("❌ Failed to create alert:", error.message);
    res.status(500).json({ success: false, message: "Failed to create alert" });
  }
};

// PATCH /api/alerts/:id/resolve
const resolveAlert = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE alerts SET is_resolved = TRUE, resolved_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Alert not found" });
    }

    const alert = result.rows[0];

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "ALERT_RESOLVED",
      entityType: "ALERT",
      entityId: alert.id,
      newData: alert,
    });

    res.status(200).json({ success: true, message: "Alert resolved", data: alert });
  } catch (error) {
    console.error("❌ Failed to resolve alert:", error.message);
    res.status(500).json({ success: false, message: "Failed to resolve alert" });
  }
};

module.exports = { getAlerts, createAlert, resolveAlert };
