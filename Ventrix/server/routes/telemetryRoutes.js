const express = require("express");
const router = express.Router();
const telemetryController = require("../controllers/telemetryController");
const { verifyToken } = require("../middleware/auth");
const { requirePermission } = require("../middleware/roles");
const { requireTelemetryIngestKey } = require("../middleware/serviceAuth");

// POST /api/telemetry — Kafka bridge ingestion authenticated via ingest key
router.post("/", requireTelemetryIngestKey, telemetryController.receiveTelemetry);

// Reads require telemetry.view dynamic permission
router.get("/latest", verifyToken, requirePermission("telemetry.view"), telemetryController.getLatest);
router.get("/:assetCode/history", verifyToken, requirePermission("telemetry.view"), telemetryController.getHistory);

module.exports = router;
