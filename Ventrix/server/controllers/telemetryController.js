const assetModel = require("../models/assetModel");
const telemetryModel = require("../models/telemetryModel");
const { isCustomerRole } = require("../middleware/roles");

const isFiniteNumber = (value) => value === undefined || value === null || Number.isFinite(Number(value));

// POST /api/telemetry
// This is the "mailbox" the simulator sends each reading to.
const receiveTelemetry = async (req, res) => {
  try {
    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ success: false, message: "Telemetry payload must be a JSON object" });
    }

    // The simulator identifies the asset by its code (e.g. "HVAC-001"),
    // not by the database's internal numeric id — so we look it up first.
    const assetCode = body.assetId;
    if (typeof assetCode !== "string" || assetCode.length === 0 || assetCode.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Missing assetId in telemetry payload",
      });
    }

    const asset = await assetModel.findAssetByCode(assetCode);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: `No registered asset found for code '${assetCode}'. Add it to the assets table first.`,
      });
    }

    // The simulator's packet looks like:
    // { assetId, timestamp, assetState, environment: {...}, telemetry: {...}, health: {...}, events: [] }
    // We pull the specific numbers we care about out of those nested
    // objects and flatten them into our simple table columns.
    const sim = body.telemetry || {};
    const env = body.environment || {};
    if (typeof sim !== "object" || Array.isArray(sim) || typeof env !== "object" || Array.isArray(env)) {
      return res.status(400).json({ success: false, message: "telemetry and environment must be JSON objects" });
    }
    const numericFields = [
      sim.supplyAirTemperature, sim.refrigerantPressure, sim.filterDP,
      sim.compressorCurrent, sim.powerConsumption, sim.remainingUsefulLife,
      env.supplyVoltage, env.humidity, env.operatingHours, body.health?.healthScore,
    ];
    if (!numericFields.every(isFiniteNumber)) {
      return res.status(400).json({ success: false, message: "Telemetry numeric fields must be finite numbers" });
    }
    if (body.timestamp && Number.isNaN(Date.parse(body.timestamp))) {
      return res.status(400).json({ success: false, message: "timestamp must be a valid ISO date" });
    }

    const reading = {
      recordedAt: body.timestamp,
      temperature: sim.supplyAirTemperature,
      pressure: sim.refrigerantPressure,
      vibration: sim.vibration != null ? sim.vibration : (sim.filterDP != null ? sim.filterDP : 1.2),
      filterDP: sim.filterDP,
      current: sim.compressorCurrent,
      voltage: env.supplyVoltage,
      humidity: env.humidity,
      power: sim.powerConsumption,
      operatingHours: env.operatingHours,
      assetState: body.assetState,
    };

    const saved = await telemetryModel.persistSimulationReading(asset.id, reading, body);

    res.status(201).json({
      success: true,
      message: "Telemetry saved",
      data: saved,
    });
  } catch (error) {
    console.error("❌ Failed to save telemetry:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to save telemetry",
    });
  }
};

// GET /api/telemetry/latest
// One newest reading per asset — for the dashboard overview cards.
// Customer-role callers only ever see their own organization's assets.
const getLatest = async (req, res) => {
  try {
    const orgId = isCustomerRole(req.user.role) ? req.user.organizationId : null;
    const rows = await telemetryModel.getLatestPerAsset(orgId);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Failed to fetch latest telemetry:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch telemetry" });
  }
};

// GET /api/telemetry/:assetCode/history
// Recent readings for one asset — for charts.
const getHistory = async (req, res) => {
  try {
    const { assetCode } = req.params;
    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 500) : 100;

    const asset = await assetModel.findAssetByCode(assetCode);
    if (!asset) {
      return res.status(404).json({ success: false, message: `No asset found for code '${assetCode}'` });
    }
    if (isCustomerRole(req.user.role) && asset.organization_id !== req.user.organizationId) {
      return res.status(403).json({ success: false, message: "Not your organization's asset" });
    }

    const rows = await telemetryModel.getHistoryForAsset(asset.id, limit);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Failed to fetch telemetry history:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch telemetry history" });
  }
};

module.exports = {
  receiveTelemetry,
  getLatest,
  getHistory,
};
