const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const {
  findUserByEmail,
  findUserById,
  createUser,
  getPermissionsForRole,
} = require("../models/userModel");

// Default a bare registration (no organizationId/roleId given) to
// Indian Railways / CUSTOMER_USER, so the demo "sign up" flow produces
// a working customer-portal account. Real Ventrix staff accounts should
// be created by a VENTRIX_ADMIN via POST /api/users instead.
const DEFAULT_ORG_CODE = "IR";
const DEFAULT_ROLE_NAME = "CUSTOMER_USER";

const register = async (req, res) => {
  try {
    const { name, email, password, organizationId, roleId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    let orgId = organizationId;
    let rId = roleId;

    if (!orgId) {
      const org = await pool.query("SELECT id FROM organizations WHERE code = $1", [DEFAULT_ORG_CODE]);
      orgId = org.rows[0]?.id || null;
    }
    if (!rId) {
      const role = await pool.query("SELECT id FROM roles WHERE name = $1", [DEFAULT_ROLE_NAME]);
      rId = role.rows[0]?.id || null;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await createUser(name, email, hashedPassword, orgId, rId);

    res.status(201).json({ message: "User Registered Successfully", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and Password required" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
    if (user.status !== "ACTIVE") {
      return res.status(403).json({ success: false, message: "This account is inactive" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const permissions = await getPermissionsForRole(user.role_name, user.role_id);

    // Role and organization claims avoid repeated hierarchy lookups; the
    // middleware still verifies the account remains active.
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role_name,
        roleId: user.role_id,
        organizationId: user.organization_id,
        organizationName: user.organization_name,
        orgType: user.org_type, // 'MANUFACTURER' or 'CUSTOMER'
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    const { password: _pw, ...safeUser } = user;
    safeUser.permissions = permissions;

    res.status(200).json({
      success: true,
      message: "Login Successful",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// GET /api/auth/me — lets the frontend refresh "who am I" without
// re-decoding the token client-side.
const me = async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const permissions = await getPermissionsForRole(user.role_name, user.role_id);
    user.permissions = permissions;
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = {
  register,
  login,
  me,
};
