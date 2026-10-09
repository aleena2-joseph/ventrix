const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const {
  findUserByEmail,
  findUserById,
  createUser,
  getPermissionsForRole,
} = require("../models/userModel");

// Default registration fallback for single-tier platform
const DEFAULT_ORG_CODE = "VTX";
const DEFAULT_ROLE_NAME = "TECHNICIAN";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const register = async (req, res) => {
  try {
    const { name, email, password, organizationId, roleId } = req.body;

    const trimmedName = typeof name === "string" ? name.trim() : "";
    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!trimmedName || !trimmedEmail || !password) {
      return res.status(400).json({ success: false, message: "Name, email, and password are required" });
    }

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json({ success: false, message: "Name must be between 2 and 100 characters" });
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({ success: false, message: "Invalid email address format" });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters long" });
    }

    const existingUser = await findUserByEmail(trimmedEmail);
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    let rId = roleId;
    if (!rId) {
      const role = await pool.query("SELECT id FROM roles WHERE name = $1", [DEFAULT_ROLE_NAME]);
      rId = role.rows[0]?.id || null;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await createUser(trimmedName, trimmedEmail, hashedPassword, rId);

    res.status(201).json({ success: true, message: "User Registered Successfully", user });
  } catch (error) {
    console.error("❌ Registration error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
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

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role_name,
        roleId: user.role_id,
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
