const express = require("express");
const router = express.Router();

const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  resetUserPassword,
  deleteUser,
  getTechnicians,
} = require("../controllers/userController");
const { verifyToken } = require("../middleware/auth");
const { requirePermission } = require("../middleware/roles");

// Public authenticated endpoint for technician dropdowns
router.get("/technicians", verifyToken, getTechnicians);

// Dynamic permission check: users.manage
router.use(verifyToken, requirePermission("users.manage"));

router.get("/", getUsers);
router.get("/:id", getUserById);
router.post("/", createUser);
router.put("/:id", updateUser);
router.patch("/:id/status", updateUserStatus);
router.patch("/:id/reset-password", resetUserPassword);
router.delete("/:id", deleteUser);

module.exports = router;
