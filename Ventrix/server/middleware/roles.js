// VENTRIX_ROLES = internal operations roles for Ventrix platform
const VENTRIX_ROLES = ["SUPER_ADMIN", "VENTRIX_ADMIN", "ADMIN", "ENGINEER", "TECHNICIAN"];
const CUSTOMER_ROLES = ["CUSTOMER_ADMIN", "CUSTOMER_USER"];
const pool = require("../config/db");

const DEFAULT_ROLE_PERMISSIONS = {
  SUPER_ADMIN: ["*"],
  VENTRIX_ADMIN: [
    "dashboard.view", "assets.view", "assets.manage", "fleet.view", "fleet.manage",
    "telemetry.view", "predictions.view", "alerts.view", "alerts.manage",
    "maintenance.view", "maintenance.manage", "service_requests.view",
    "service_requests.create", "service_requests.manage", "inventory.manage",
    "procurement.manage", "products.manage", "customers.manage",
    "users.manage", "reports.view", "settings.manage"
  ],
  ADMIN: [
    "dashboard.view", "assets.view", "assets.manage", "fleet.view", "fleet.manage",
    "telemetry.view", "predictions.view", "alerts.view", "alerts.manage",
    "maintenance.view", "maintenance.manage", "service_requests.view",
    "service_requests.create", "service_requests.manage", "inventory.manage",
    "procurement.manage", "products.manage", "customers.manage",
    "users.manage", "reports.view", "settings.manage"
  ],
  ENGINEER: [
    "dashboard.view", "assets.view", "fleet.view", "telemetry.view", "predictions.view", "alerts.view",
    "maintenance.view", "maintenance.manage", "service_requests.view",
    "service_requests.create", "inventory.manage", "products.manage", "reports.view"
  ],
  TECHNICIAN: [
    "dashboard.view", "assets.view", "telemetry.view", "predictions.view", "alerts.view",
    "maintenance.view", "maintenance.manage", "service_requests.view",
    "service_requests.create", "inventory.manage", "products.manage", "reports.view"
  ],
  CUSTOMER_ADMIN: [
    "dashboard.view", "assets.view", "fleet.view", "fleet.manage", "telemetry.view", "predictions.view",
    "alerts.view", "maintenance.view", "service_requests.view", "service_requests.create",
    "users.manage", "reports.view"
  ],
  CUSTOMER_USER: [
    "dashboard.view", "assets.view", "fleet.view", "telemetry.view", "predictions.view",
    "alerts.view", "maintenance.view", "service_requests.view", "service_requests.create",
    "reports.view"
  ],
};

// requireRole('VENTRIX_ADMIN', 'ENGINEER') -> 403s anyone else.
// Must run after verifyToken.
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  const roleName = req.user.role_name || req.user.role;
  if (!allowedRoles.includes(roleName)) {
    return res.status(403).json({
      success: false,
      message: `This action requires one of: ${allowedRoles.join(", ")}`,
    });
  }
  next();
};

// requireVentrixStaff -> only Ventrix's own internal roles (any of them).
const requireVentrixStaff = requireRole(...VENTRIX_ROLES);

// Permission checks are database-backed with resilient fallback
const requirePermission = (permission) => async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  const roleName = req.user.role_name || req.user.role;

  // Super Admin always has full access
  if (roleName === "SUPER_ADMIN" || req.user.role === "SUPER_ADMIN") return next();

  try {
    const result = await pool.query(
      `SELECT 1 FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = $1 AND rp.permission_key = $2`,
      [roleName, permission]
    );

    if (result.rows.length > 0) {
      return next();
    }

    // Check if the user has this permission in baseline defaults
    const defaults = DEFAULT_ROLE_PERMISSIONS[roleName] || [];
    if (defaults.includes("*") || defaults.includes(permission)) {
      return next();
    }

    return res.status(403).json({ success: false, message: `Missing permission: ${permission}` });
  } catch (error) {
    console.error("Permission check DB query fallback:", error.message);
    // Safe fallback to default matrix if table is being initialized
    const defaults = DEFAULT_ROLE_PERMISSIONS[roleName] || [];
    if (defaults.includes("*") || defaults.includes(permission)) {
      return next();
    }
    return res.status(403).json({ success: false, message: `Missing permission: ${permission}` });
  }
};

const isVentrixRole = (role) => VENTRIX_ROLES.includes(role);
const isCustomerRole = (role) => CUSTOMER_ROLES.includes(role);

module.exports = {
  VENTRIX_ROLES,
  CUSTOMER_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  requireRole,
  requireVentrixStaff,
  requirePermission,
  isVentrixRole,
  isCustomerRole,
};
