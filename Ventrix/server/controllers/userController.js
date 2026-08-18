const bcrypt = require("bcrypt");
const pool = require("../config/db");
const userModel = require("../models/userModel");
const { isCustomerRole } = require("../middleware/roles");

// GET /api/users — Supports filtering by search, roleId, organizationId, status
const getUsers = async (req, res) => {
  try {
    const { search, roleId, organizationId, status } = req.query;
    const filters = {};

    if (search) filters.search = search.trim();
    if (roleId) filters.roleId = Number(roleId);
    if (status) filters.status = status.toUpperCase();

    if (isCustomerRole(req.user.role)) {
      // Customer roles can only ever see their own organization's users
      filters.organizationId = req.user.organizationId;
    } else if (organizationId) {
      filters.organizationId = Number(organizationId);
    }

    const rows = await userModel.getAllUsers(filters);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Failed to list users:", error.message);
    res.status(500).json({ success: false, message: "Failed to list users" });
  }
};

// GET /api/users/:id — Get user by ID
const getUserById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await userModel.findUserById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (isCustomerRole(req.user.role) && user.organization_id !== req.user.organizationId) {
      return res.status(403).json({ success: false, message: "Access denied to user in another organization" });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error("❌ Failed to fetch user:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch user" });
  }
};

// POST /api/users — Create a user
const createUser = async (req, res) => {
  try {
    const { name, email, password, organizationId, roleId } = req.body;
    if (!name || !email || !password || !roleId) {
      return res.status(400).json({ success: false, message: "Name, email, password, and role are required" });
    }

    let targetOrgId = organizationId ? Number(organizationId) : null;
    const targetRoleId = Number(roleId);

    // Verify role exists
    const roleResult = await pool.query("SELECT id, name FROM roles WHERE id = $1", [targetRoleId]);
    const roleRow = roleResult.rows[0];
    if (!roleRow) {
      return res.status(400).json({ success: false, message: "Invalid role specified" });
    }

    if (isCustomerRole(req.user.role)) {
      targetOrgId = req.user.organizationId;
      if (!isCustomerRole(roleRow.name)) {
        return res.status(403).json({
          success: false,
          message: "Customer admins can only create CUSTOMER_ADMIN or CUSTOMER_USER accounts",
        });
      }
    } else {
      // If Ventrix admin doesn't supply orgId, default to Ventrix org (manufacturer)
      if (!targetOrgId) {
        const vtxOrg = await pool.query("SELECT id FROM organizations WHERE type = 'MANUFACTURER' LIMIT 1");
        targetOrgId = vtxOrg.rows[0]?.id || null;
      }
    }

    const existing = await userModel.findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ success: false, message: "A user with this email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await userModel.createUser(name.trim(), email.trim().toLowerCase(), hashed, targetOrgId, targetRoleId);

    const auditModel = require("../models/auditModel");
    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "USER_CREATED",
      entityType: "USER",
      entityId: user.id,
      newData: { name: user.name, email: user.email, role_name: roleRow.name },
    });

    res.status(201).json({ success: true, message: "User created successfully", data: user });
  } catch (error) {
    console.error("❌ Failed to create user:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to create user" });
  }
};

// PUT /api/users/:id — Update user details (Name, Email, Role, Organization, Status)
const updateUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email, roleId, organizationId, status } = req.body;

    const existing = await userModel.findUserById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Customer admin cannot touch users outside their organization
    if (isCustomerRole(req.user.role) && existing.organization_id !== req.user.organizationId) {
      return res.status(403).json({ success: false, message: "Access denied to user in another organization" });
    }

    // Protect last active Admin from role changes
    if ((existing.role_name === "ADMIN" || existing.role_name === "SUPER_ADMIN") && roleId && Number(roleId) !== existing.role_id) {
      const adminCount = await userModel.countSuperAdmins();
      if (adminCount <= 1) {
        return res.status(403).json({
          success: false,
          message: "Cannot change the role of the only active Administrator",
        });
      }
    }

    const fields = {};
    if (name) fields.name = name.trim();
    if (email) {
      const emailLower = email.trim().toLowerCase();
      if (emailLower !== existing.email.toLowerCase()) {
        const emailCheck = await userModel.findUserByEmail(emailLower);
        if (emailCheck && emailCheck.id !== id) {
          return res.status(400).json({ success: false, message: "Email already in use by another user" });
        }
      }
      fields.email = emailLower;
    }

    if (roleId) {
      const targetRoleId = Number(roleId);
      const roleResult = await pool.query("SELECT id, name FROM roles WHERE id = $1", [targetRoleId]);
      const roleRow = roleResult.rows[0];
      if (!roleRow) {
        return res.status(400).json({ success: false, message: "Invalid role specified" });
      }

      if (isCustomerRole(req.user.role) && !isCustomerRole(roleRow.name)) {
        return res.status(403).json({
          success: false,
          message: "Customer admins can only assign customer roles",
        });
      }
      fields.role_id = targetRoleId;
    }

    if (organizationId !== undefined && !isCustomerRole(req.user.role)) {
      fields.organization_id = organizationId ? Number(organizationId) : null;
    }

    if (status && ["ACTIVE", "INACTIVE"].includes(status)) {
      if (status === "INACTIVE" && id === req.user.id) {
        return res.status(400).json({ success: false, message: "You cannot deactivate your own account" });
      }
      fields.status = status;
    }

    const updated = await userModel.updateUser(id, fields);
    res.status(200).json({ success: true, message: "User updated successfully", data: updated });
  } catch (error) {
    console.error("❌ Failed to update user:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to update user" });
  }
};

// PATCH /api/users/:id/status — Quick toggle active/inactive status
const updateUserStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!status || !["ACTIVE", "INACTIVE"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be ACTIVE or INACTIVE" });
    }

    const target = await userModel.findUserById(id);
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (isCustomerRole(req.user.role) && target.organization_id !== req.user.organizationId) {
      return res.status(403).json({ success: false, message: "Access denied to user in another organization" });
    }

    if (status === "INACTIVE" && id === req.user.id) {
      return res.status(400).json({ success: false, message: "You cannot deactivate your own account" });
    }

    if (status === "INACTIVE" && (target.role_name === "ADMIN" || target.role_name === "SUPER_ADMIN")) {
      const adminCount = await userModel.countSuperAdmins();
      if (adminCount <= 1) {
        return res.status(403).json({
          success: false,
          message: "Cannot deactivate the only active Administrator account",
        });
      }
    }

    const updated = await userModel.updateUserStatus(id, status);
    res.status(200).json({ success: true, message: `User status changed to ${status}`, data: updated });
  } catch (error) {
    console.error("❌ Failed to update user status:", error.message);
    res.status(500).json({ success: false, message: "Failed to update user status" });
  }
};

// PATCH /api/users/:id/reset-password — Admin reset user password
const resetUserPassword = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters long" });
    }

    const target = await userModel.findUserById(id);
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (isCustomerRole(req.user.role) && target.organization_id !== req.user.organizationId) {
      return res.status(403).json({ success: false, message: "Access denied to user in another organization" });
    }

    const hashed = await bcrypt.hash(password, 10);
    await userModel.updateUserPassword(id, hashed);

    res.status(200).json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("❌ Failed to reset password:", error.message);
    res.status(500).json({ success: false, message: "Failed to reset password" });
  }
};

// DELETE /api/users/:id — Delete user
const deleteUser = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: "You cannot delete your own account" });
    }

    const target = await userModel.findUserById(id);
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (isCustomerRole(req.user.role) && target.organization_id !== req.user.organizationId) {
      return res.status(403).json({ success: false, message: "Access denied to user in another organization" });
    }

    if (target.role_name === "ADMIN" || target.role_name === "SUPER_ADMIN") {
      const adminCount = await userModel.countSuperAdmins();
      if (adminCount <= 1) {
        return res.status(403).json({
          success: false,
          message: "Cannot delete the only Administrator account",
        });
      }
    }

    const deleted = await userModel.deleteUser(id);
    res.status(200).json({ success: true, message: "User deleted successfully", data: deleted });
  } catch (error) {
    console.error("❌ Failed to delete user:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to delete user" });
  }
};

// GET /api/users/technicians — Accessible by all authenticated staff to populate technician selection dropdowns
const getTechnicians = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, r.name as role_name, u.status
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE r.name IN ('TECHNICIAN', 'ENGINEER') AND u.status = 'ACTIVE'
       ORDER BY u.name ASC`
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("❌ Failed to list technicians:", error.message);
    res.status(500).json({ success: false, message: "Failed to list technicians" });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  resetUserPassword,
  deleteUser,
  getTechnicians,
};
