const jwt = require("jsonwebtoken");
const pool = require("../config/db");

// Reads the Bearer token, verifies it, checks the account is still active,
// and attaches the decoded claims as req.user.
const verifyToken = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Missing or invalid Authorization header" });
  }

  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query("SELECT status FROM users WHERE id = $1", [decoded.id]);
    if (result.rows.length === 0 || result.rows[0].status !== "ACTIVE") {
      return res.status(401).json({ success: false, message: "Account is inactive or no longer exists" });
    }
    req.user = decoded; // { id, name, email, role, organizationId, orgType }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

module.exports = { verifyToken };
