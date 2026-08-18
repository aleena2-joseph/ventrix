const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const { requirePermission } = require("../middleware/roles");
const {
  getRoles,
  getPermissionMatrix,
  updateRolePermission,
  batchUpdateRolePermissions,
  getMyPermissions,
} = require("../controllers/roleController");

// List roles (accessible by authenticated users)
router.get("/", verifyToken, getRoles);

// Current user's dynamic permissions
router.get("/my-permissions", verifyToken, getMyPermissions);

// Permission matrix (requires settings.manage permission)
router.get(
  "/permissions/matrix",
  verifyToken,
  requirePermission("settings.manage"),
  getPermissionMatrix
);

// Toggle single permission for a role
router.patch(
  "/:roleId/permissions",
  verifyToken,
  requirePermission("settings.manage"),
  updateRolePermission
);

// Batch update permissions for a role
router.put(
  "/:roleId/permissions/batch",
  verifyToken,
  requirePermission("settings.manage"),
  batchUpdateRolePermissions
);

module.exports = router;
