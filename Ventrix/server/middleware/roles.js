// Single-Tier Platform Roles (Admin, Engineer, Technician)
const ROLES = ["ADMIN", "ENGINEER", "TECHNICIAN"];
const VENTRIX_ROLES = ["ADMIN", "VENTRIX_ADMIN", "ENGINEER", "TECHNICIAN"];
const CUSTOMER_ROLES = [];
const pool = require("../config/db");

const DEFAULT_ROLE_PERMISSIONS = {
  ADMIN: ["*"],
  VENTRIX_ADMIN: ["*"],
  ENGINEER: [
    "dashboard.view", "assets.view", "fleet.view", "telemetry.view", "predictions.view", "alerts.view",
    "maintenance.view", "maintenance.manage", "maintenance.verify", "inventory.view", "inventory.manage",
    "parts.request", "parts.issue", "reports.view"
  ],
  TECHNICIAN: [
    "dashboard.view", "assets.view", "telemetry.view", "predictions.view", "alerts.view",
    "maintenance.view", "maintenance.manage", "inventory.view", "parts.request", "reports.view"
  ],
};

// requireRole('ADMIN', 'ENGINEER') -> 403s anyone else.
// Must run after verifyToken.
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  const roleName = (req.user.role_name || req.user.role || "").toUpperCase();
  const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());
  if (!normalizedAllowed.includes(roleName) && roleName !== "ADMIN" && roleName !== "VENTRIX_ADMIN") {
    return res.status(403).json({
      success: false,
      message: `This action requires one of: ${allowedRoles.join(", ")}`,
    });
  }
  next();
};

const requireVentrixStaff = requireRole(...VENTRIX_ROLES);

// Permission checks are database-backed with resilient fallback
const requirePermission = (permission) => async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  const roleName = req.user.role_name || req.user.role;

  // Admin always has full access
  if (roleName === "ADMIN" || roleName === "VENTRIX_ADMIN") return next();

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

    const defaults = DEFAULT_ROLE_PERMISSIONS[roleName] || [];
    if (defaults.includes("*") || defaults.includes(permission)) {
      return next();
    }

    return res.status(403).json({ success: false, message: `Missing permission: ${permission}` });
  } catch (error) {
    console.error("Permission check DB query fallback:", error.message);
    const defaults = DEFAULT_ROLE_PERMISSIONS[roleName] || [];
    if (defaults.includes("*") || defaults.includes(permission)) {
      return next();
    }
    return res.status(403).json({ success: false, message: `Missing permission: ${permission}` });
  }
};

const isVentrixRole = () => true;
const isCustomerRole = () => false;

module.exports = {
  ROLES,
  VENTRIX_ROLES,
  CUSTOMER_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  requireRole,
  requireVentrixStaff,
  requirePermission,
  isVentrixRole,
  isCustomerRole,
};
