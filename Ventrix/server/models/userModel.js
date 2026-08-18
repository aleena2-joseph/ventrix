const pool = require("../config/db");

// Joined with role/org so authController can build a JWT payload and
// the frontend can render "who am I" without a second request.
const findUserByEmail = async (email) => {
  const result = await pool.query(
    `SELECT u.*, r.name AS role_name, o.name AS organization_name, o.type AS org_type
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     LEFT JOIN organizations o ON u.organization_id = o.id
     WHERE LOWER(u.email) = LOWER($1)`,
    [email]
  );
  return result.rows[0];
};

const findUserById = async (id) => {
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.status, u.created_at, u.updated_at,
            u.organization_id, o.name AS organization_name, o.type AS org_type,
            u.role_id, r.name AS role_name
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     LEFT JOIN organizations o ON u.organization_id = o.id
     WHERE u.id = $1`,
    [id]
  );
  return result.rows[0];
};

// organizationId/roleId default to Indian Railways / CUSTOMER_USER so a
// self-registration through POST /api/auth/register produces a sensible
// account even if the frontend doesn't ask for those fields explicitly.
const createUser = async (name, email, password, organizationId, roleId) => {
  const result = await pool.query(
    `INSERT INTO users (name, email, password, organization_id, role_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, organization_id, role_id, status, created_at`,
    [name, email, password, organizationId, roleId]
  );
  return findUserById(result.rows[0].id);
};

// Filterable users query supporting search, role, organization, and status filters
const getAllUsers = async (filters = {}) => {
  const conditions = [];
  const values = [];

  if (filters.organizationId) {
    values.push(filters.organizationId);
    conditions.push(`u.organization_id = $${values.length}`);
  }

  if (filters.roleId) {
    values.push(filters.roleId);
    conditions.push(`u.role_id = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`u.status = $${values.length}`);
  }

  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(`(u.name ILIKE $${values.length} OR u.email ILIKE $${values.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT u.id, u.name, u.email, u.status, u.created_at, u.updated_at,
           u.organization_id, o.name AS organization_name, o.type AS org_type,
           u.role_id, r.name AS role_name
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN organizations o ON u.organization_id = o.id
    ${whereClause}
    ORDER BY u.id ASC
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const findUsersByOrganization = async (organizationId, filters = {}) => {
  return getAllUsers({ ...filters, organizationId });
};

// Update user details (name, email, role_id, organization_id, status)
const updateUser = async (id, fields) => {
  const allowed = ["name", "email", "role_id", "organization_id", "status"];
  const updates = [];
  const values = [];

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      values.push(fields[key]);
      updates.push(`${key} = $${values.length}`);
    }
  }

  if (updates.length === 0) {
    return findUserById(id);
  }

  values.push(id);
  const query = `
    UPDATE users
    SET ${updates.join(", ")}, updated_at = NOW()
    WHERE id = $${values.length}
    RETURNING id
  `;

  await pool.query(query, values);
  return findUserById(id);
};

// Update user password
const updateUserPassword = async (id, hashedPassword) => {
  await pool.query(
    `UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2`,
    [hashedPassword, id]
  );
  return true;
};

// Quick status toggle
const updateUserStatus = async (id, status) => {
  const result = await pool.query(
    `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email, status`,
    [status, id]
  );
  return result.rows[0];
};

// Delete user
const deleteUser = async (id) => {
  const result = await pool.query(`DELETE FROM users WHERE id = $1 RETURNING id, name, email`, [id]);
  return result.rows[0];
};

// Count active Admins for lockout protection
const countSuperAdmins = async () => {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.name IN ('ADMIN', 'VENTRIX_ADMIN') AND u.status = 'ACTIVE'`
  );
  return result.rows[0]?.count || 0;
};

// Get permissions for a role or user
const getPermissionsForRole = async (roleName, roleId) => {
  try {
    if (roleName === "ADMIN" || roleName === "SUPER_ADMIN" || roleName === "VENTRIX_ADMIN") {
      const all = await pool.query("SELECT permission_key FROM permissions");
      if (all.rows.length > 0) return all.rows.map((r) => r.permission_key);
    }

    const result = await pool.query(
      `SELECT rp.permission_key
       FROM role_permissions rp
       WHERE rp.role_id = $1`,
      [roleId]
    );
    if (result.rows.length > 0) {
      return result.rows.map((r) => r.permission_key);
    }
  } catch (err) {
    console.error("getPermissionsForRole fallback:", err.message);
  }

  // Fallback defaults
  const DEFAULTS = {
    ADMIN: ["*"],
    VENTRIX_ADMIN: ["*"],
    SUPER_ADMIN: ["*"],
    VENTRIX_ADMIN: [
      "dashboard.view", "assets.view", "assets.manage",
      "telemetry.view", "alerts.view", "alerts.manage",
      "maintenance.view", "maintenance.manage", "service_requests.view",
      "service_requests.create", "service_requests.manage", "inventory.manage",
      "users.manage", "settings.manage"
    ],
    ADMIN: [
      "dashboard.view", "assets.view", "assets.manage",
      "telemetry.view", "alerts.view", "alerts.manage",
      "maintenance.view", "maintenance.manage", "service_requests.view",
      "service_requests.create", "service_requests.manage", "inventory.manage",
      "users.manage", "settings.manage"
    ],
    ENGINEER: [
      "dashboard.view", "assets.view", "assets.manage",
      "telemetry.view", "alerts.view",
      "maintenance.view", "maintenance.manage", "service_requests.view",
      "service_requests.create", "inventory.manage"
    ],
    TECHNICIAN: [
      "dashboard.view", "assets.view", "telemetry.view",
      "maintenance.view", "maintenance.manage", "service_requests.view",
      "service_requests.create"
    ],
  };

  return DEFAULTS[roleName] || DEFAULTS.VENTRIX_ADMIN;
};

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  findUsersByOrganization,
  getAllUsers,
  updateUser,
  updateUserPassword,
  updateUserStatus,
  deleteUser,
  countSuperAdmins,
  getPermissionsForRole,
};
