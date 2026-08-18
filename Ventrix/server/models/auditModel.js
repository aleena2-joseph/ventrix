const pool = require("../config/db");

/**
 * Log an audit entry into the audit_logs table.
 * @param {Object} entry
 * @param {number|null} [entry.userId]
 * @param {number|null} [entry.organizationId]
 * @param {string} entry.action
 * @param {string} entry.entityType
 * @param {string|number|null} [entry.entityId]
 * @param {Object|null} [entry.oldData]
 * @param {Object|null} [entry.newData]
 */
const logAction = async ({
  userId = null,
  organizationId = null,
  action,
  entityType,
  entityId = null,
  oldData = null,
  newData = null,
}) => {
  try {
    const result = await pool.query(
      `INSERT INTO audit_logs (user_id, organization_id, action, entity_type, entity_id, old_data, new_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        userId,
        organizationId,
        action,
        entityType,
        entityId !== null && entityId !== undefined ? String(entityId) : null,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null,
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error("⚠️ Failed to record audit log:", error.message);
    return null;
  }
};

/**
 * Retrieve audit logs with optional filters
 * @param {Object} filters
 * @param {number|null} [filters.organizationId]
 * @param {number|null} [filters.userId]
 * @param {string|null} [filters.entityType]
 * @param {string|null} [filters.entityId]
 * @param {string|null} [filters.action]
 * @param {number} [filters.limit]
 * @param {number} [filters.offset]
 */
const getAuditLogs = async (filters = {}) => {
  const conditions = [];
  const values = [];

  if (filters.organizationId) {
    values.push(filters.organizationId);
    conditions.push(`al.organization_id = $${values.length}`);
  }

  if (filters.userId) {
    values.push(filters.userId);
    conditions.push(`al.user_id = $${values.length}`);
  }

  if (filters.entityType) {
    values.push(filters.entityType);
    conditions.push(`al.entity_type = $${values.length}`);
  }

  if (filters.entityId) {
    values.push(String(filters.entityId));
    conditions.push(`al.entity_id = $${values.length}`);
  }

  if (filters.action) {
    values.push(filters.action);
    conditions.push(`al.action = $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Number(filters.limit) || 50;
  const offset = Number(filters.offset) || 0;

  values.push(limit, offset);
  const limitOffsetClause = `LIMIT $${values.length - 1} OFFSET $${values.length}`;

  const query = `
    SELECT al.*,
           u.name AS user_name,
           u.email AS user_email,
           o.name AS organization_name
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    LEFT JOIN organizations o ON al.organization_id = o.id
    ${whereClause}
    ORDER BY al.created_at DESC
    ${limitOffsetClause}
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

module.exports = {
  logAction,
  getAuditLogs,
};
