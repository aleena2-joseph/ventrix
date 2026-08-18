const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const telemetryRoutes = require("./routes/telemetryRoutes");
const assetRoutes = require("./routes/assetRoutes");
const roleRoutes = require("./routes/roleRoutes");
const userRoutes = require("./routes/userRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const serviceRequestRoutes = require("./routes/serviceRequestRoutes");
const alertRoutes = require("./routes/alertRoutes");

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  return localhostRegex.test(origin);
};

app.use(cors({
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-telemetry-key", "x-requested-with"],
}));
app.use(express.json({ limit: "100kb" }));

app.get("/", (req, res) => {
  res.send("Ventrix HVAC RUL Backend Running 🚀");
});

app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.status(200).json({
      success: true,
      message: "Database Connected Successfully",
      serverTime: result.rows[0].now,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Database Connection Failed",
    });
  }
});

const PORT = process.env.PORT || 5000;

const autoStreamer = require("./services/autoStreamer");

app.use("/api/auth", authRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/service-requests", serviceRequestRoutes);
app.use("/api/alerts", alertRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server Running on Port ${PORT}`);
  autoStreamer.start(3000);
});

