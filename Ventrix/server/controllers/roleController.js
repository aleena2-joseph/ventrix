const pool = require("../config/db");
const userModel = require("../models/userModel");
const { DEFAULT_ROLE_PERMISSIONS } = require("../middleware/roles");

const LOCKED_ROLES = ["ADMIN"];

// Helper to auto-create permissions tables if they don't exist yet
async function ensurePermissionsSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        permission_key VARCHAR(80) PRIMARY KEY,
        label VARCHAR(120) NOT NULL,
        category VARCHAR(50) NOT NULL,
        description VARCHAR(250)
      );

      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_key VARCHAR(80) NOT NULL REFERENCES permissions(permission_key) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_key)
      );

      INSERT INTO permissions (permission_key, label, category, description) VALUES
        ('dashboard.view', 'View dashboard', 'Monitoring', 'View fleet overview and KPIs'),
        ('assets.view', 'View assets', 'Assets', 'View asset registry and details'),
        ('assets.manage', 'Manage assets', 'Assets', 'Create, edit, and update asset status'),
        ('fleet.view', 'View fleet structure', 'Assets', 'View projects, trains, and coaches'),
        ('fleet.manage', 'Manage fleet structure', 'Assets', 'Create projects, trains, and coaches'),
        ('telemetry.view', 'View telemetry', 'Monitoring', 'View live and historical telemetry'),
        ('predictions.view', 'View predictions', 'Monitoring', 'View RUL and health predictions'),
        ('alerts.view', 'View alerts', 'Monitoring', 'View active alerts'),
        ('alerts.manage', 'Manage alerts', 'Monitoring', 'Create and resolve alerts'),
        ('maintenance.view', 'View maintenance', 'Operations', 'View schedules and work orders'),
        ('maintenance.manage', 'Manage maintenance', 'Operations', 'Create and update maintenance work'),
        ('service_requests.view', 'View service requests', 'Operations', 'View submitted service requests'),
        ('service_requests.create', 'Create service requests', 'Operations', 'Submit service requests'),
        ('service_requests.manage', 'Manage service requests', 'Operations', 'Triage and resolve service requests'),
        ('inventory.manage', 'Manage inventory', 'Operations', 'Manage parts and stock'),
        ('procurement.manage', 'Manage procurement', 'Operations', 'Manage suppliers and purchase orders'),
        ('products.manage', 'Manage products', 'Administration', 'Manage product catalogue'),
        ('customers.manage', 'Manage customers', 'Administration', 'Manage customer organizations'),
        ('users.manage', 'Manage users', 'Administration', 'Create, activate, and deactivate users'),
        ('settings.manage', 'Manage permission matrix', 'Administration', 'Configure role permissions'),
        ('reports.view', 'View fleet reports', 'Monitoring', 'View and export fleet health and audit reports')
      ON CONFLICT (permission_key) DO NOTHING;

      INSERT INTO role_permissions (role_id, permission_key)
      SELECT r.id, p.permission_key
      FROM roles r
      JOIN permissions p ON (
        (r.name IN ('ADMIN', 'VENTRIX_ADMIN') AND p.permission_key IN (
          'dashboard.view','assets.view','assets.manage','fleet.view','fleet.manage',
          'telemetry.view','predictions.view','alerts.view','alerts.manage',
          'maintenance.view','maintenance.manage','service_requests.view','service_requests.create','service_requests.manage',
          'inventory.manage','procurement.manage','products.manage','customers.manage','users.manage','reports.view','settings.manage'
        ))
        OR (r.name = 'ENGINEER' AND p.permission_key IN (
          'dashboard.view','assets.view','fleet.view','telemetry.view','predictions.view','alerts.view',
          'maintenance.view','maintenance.manage','service_requests.view','service_requests.create',
          'inventory.manage','products.manage','reports.view'
        ))
        OR (r.name = 'TECHNICIAN' AND p.permission_key IN (
          'dashboard.view','assets.view','telemetry.view','predictions.view','alerts.view',
          'maintenance.view','maintenance.manage','service_requests.view','service_requests.create','inventory.manage','products.manage','reports.view'
        ))
      )
      ON CONFLICT DO NOTHING;
    `);
  } catch (err) {
    console.error("Auto-schema verification error:", err.message);
  }
}

// GET /api/roles — Lists all roles with active/total user counts
const getRoles = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.id, r.name, r.description,
             COUNT(u.id)::int AS user_count,
             COUNT(CASE WHEN u.status = 'ACTIVE' THEN 1 END)::int AS active_user_count
      FROM roles r
      LEFT JOIN users u ON u.role_id = r.id
      GROUP BY r.id, r.name, r.description
      ORDER BY r.id ASC
    `);

    const data = result.rows.map((role) => ({
      ...role,
      isLocked: LOCKED_ROLES.includes(role.name),
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Failed to list roles:", error.message);
    res.status(500).json({ success: false, message: "Failed to list roles" });
  }
};

// GET /api/roles/permissions/matrix
const getPermissionMatrix = async (req, res) => {
  try {
    await ensurePermissionsSchema();

    const [rolesResult, permissionsResult, grantsResult] = await Promise.all([
      pool.query(`
        SELECT r.id, r.name, r.description,
               COUNT(u.id)::int AS user_count
        FROM roles r
        LEFT JOIN users u ON u.role_id = r.id
        GROUP BY r.id, r.name, r.description
        ORDER BY r.id ASC
      `),
      pool.query(
        "SELECT permission_key, label, category, description FROM permissions ORDER BY category ASC, permission_key ASC"
      ),
      pool.query("SELECT role_id, permission_key FROM role_permissions"),
    ]);

    const grants = {};
    for (const row of grantsResult.rows) {
      const key = String(row.role_id);
      if (!grants[key]) grants[key] = [];
      grants[key].push(row.permission_key);
    }

    const roles = rolesResult.rows.map((role) => ({
      ...role,
      isLocked: LOCKED_ROLES.includes(role.name),
    }));

    res.status(200).json({
      success: true,
      data: {
        roles,
        permissions: permissionsResult.rows,
        grants,
      },
    });
  } catch (error) {
    console.error("Failed to load permission matrix:", error.message);
    res.status(500).json({ success: false, message: "Failed to load permission matrix" });
  }
};

// PATCH /api/roles/:roleId/permissions
// Body: { permissionKey: string, enabled: boolean }
const updateRolePermission = async (req, res) => {
  const roleId = Number(req.params.roleId);
  const { permissionKey, enabled } = req.body;

  if (!Number.isInteger(roleId) || roleId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid role id" });
  }
  if (typeof permissionKey !== "string" || permissionKey.length === 0) {
    return res.status(400).json({ success: false, message: "permissionKey is required" });
  }
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ success: false, message: "enabled must be a boolean" });
  }

  await ensurePermissionsSchema();

  const client = await pool.connect();
  try {
    const roleResult = await client.query("SELECT id, name FROM roles WHERE id = $1", [roleId]);
    const role = roleResult.rows[0];
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }
    if (LOCKED_ROLES.includes(role.name)) {
      return res.status(403).json({
        success: false,
        message: `${role.name} permissions are locked and cannot be changed`,
      });
    }

    const permissionResult = await client.query(
      "SELECT permission_key FROM permissions WHERE permission_key = $1",
      [permissionKey]
    );
    if (permissionResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Permission not found" });
    }

    if (enabled) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_key)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [roleId, permissionKey]
      );
    } else {
      await client.query(
        "DELETE FROM role_permissions WHERE role_id = $1 AND permission_key = $2",
        [roleId, permissionKey]
      );
    }

    res.status(200).json({
      success: true,
      message: enabled ? "Permission granted" : "Permission revoked",
      data: { roleId, permissionKey, enabled },
    });
  } catch (error) {
    console.error("Failed to update role permission:", error.message);
    res.status(500).json({ success: false, message: "Failed to update role permission" });
  } finally {
    client.release();
  }
};

// PUT /api/roles/:roleId/permissions/batch
// Body: { permissions: string[] }
const batchUpdateRolePermissions = async (req, res) => {
  const roleId = Number(req.params.roleId);
  const { permissions } = req.body;

  if (!Number.isInteger(roleId) || roleId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid role id" });
  }
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ success: false, message: "permissions must be an array of string keys" });
  }

  await ensurePermissionsSchema();

  const client = await pool.connect();
  try {
    const roleResult = await client.query("SELECT id, name FROM roles WHERE id = $1", [roleId]);
    const role = roleResult.rows[0];
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }
    if (LOCKED_ROLES.includes(role.name)) {
      return res.status(403).json({
        success: false,
        message: `${role.name} permissions are locked and cannot be changed`,
      });
    }

    await client.query("BEGIN");
    await client.query("DELETE FROM role_permissions WHERE role_id = $1", [roleId]);

    if (permissions.length > 0) {
      for (const key of permissions) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_key)
           SELECT $1, permission_key FROM permissions WHERE permission_key = $2
           ON CONFLICT DO NOTHING`,
          [roleId, key]
        );
      }
    }

    await client.query("COMMIT");

    res.status(200).json({
      success: true,
      message: "Role permissions updated successfully",
      data: { roleId, permissions },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to batch update role permissions:", error.message);
    res.status(500).json({ success: false, message: "Failed to update role permissions" });
  } finally {
    client.release();
  }
};

// GET /api/roles/my-permissions — Get current user's dynamic permissions
const getMyPermissions = async (req, res) => {
  try {
    await ensurePermissionsSchema();
    const permissions = await userModel.getPermissionsForRole(req.user.role, req.user.roleId);
    res.status(200).json({ success: true, data: permissions });
  } catch (error) {
    console.error("Failed to get user permissions fallback:", error.message);
    const defaults = DEFAULT_ROLE_PERMISSIONS[req.user.role] || [];
    res.status(200).json({ success: true, data: defaults });
  }
};

module.exports = {
  getRoles,
  getPermissionMatrix,
  updateRolePermission,
  batchUpdateRolePermissions,
  getMyPermissions,
};
