const assetModel = require("../models/assetModel");
const telemetryModel = require("../models/telemetryModel");
const { isCustomerRole } = require("../middleware/roles");

const VALID_ASSET_STATES = [
  "NOMINAL",
  "RUNNING",
  "WARNING",
  "CRITICAL",
  "ALARM",
  "OFFLINE",
  "MAINTENANCE",
  "FAULT",
  "IDLE",
];

const VALID_HEALTH_STATUSES = [
  "NOMINAL",
  "GOOD",
  "WARNING",
  "CRITICAL",
  "ALARM",
  "OFFLINE",
  "MAINTENANCE",
];

function validateNumericRange(fieldName, value, min, max, unit, isRequired, errors) {
  if (value === undefined || value === null) {
    if (isRequired) {
      errors.push(`Field '${fieldName}' is required`);
    }
    return;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    errors.push(`Field '${fieldName}' must be a valid finite number`);
    return;
  }
  if (num < min || num > max) {
    errors.push(`Field '${fieldName}' (${num}${unit}) is outside physical plausible range [${min}${unit}, ${max}${unit}]`);
  }
}

// POST /api/telemetry
// Ingestion endpoint for simulator readings with strict physical validation
const receiveTelemetry = async (req, res) => {
  try {
    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        success: false,
        message: "Telemetry payload must be a JSON object",
        errors: ["Payload must be a non-empty JSON object"],
      });
    }

    const validationErrors = [];

    // 1. Asset ID Validation
    const assetCode = typeof body.assetId === "string" ? body.assetId.trim() : "";
    if (!assetCode) {
      validationErrors.push("Missing or invalid 'assetId' (must be a non-empty string)");
    } else if (assetCode.length > 50 || !/^[A-Za-z0-9\-_]+$/.test(assetCode)) {
      validationErrors.push("'assetId' contains invalid characters or exceeds 50 characters");
    }

    // 2. Timestamp Validation
    let recordedAt = new Date().toISOString();
    if (body.timestamp !== undefined && body.timestamp !== null) {
      const parsedTime = Date.parse(body.timestamp);
      if (Number.isNaN(parsedTime)) {
        validationErrors.push("'timestamp' must be a valid ISO 8601 date string");
      } else {
        const now = Date.now();
        const maxFuture = now + 24 * 60 * 60 * 1000; // max 24h into future
        const maxPast = now - 60 * 24 * 60 * 60 * 1000; // max 60 days into past
        if (parsedTime > maxFuture) {
          validationErrors.push("'timestamp' cannot be more than 24 hours in the future");
        } else if (parsedTime < maxPast) {
          validationErrors.push("'timestamp' cannot be older than 60 days");
        } else {
          recordedAt = new Date(parsedTime).toISOString();
        }
      }
    }

    // 3. Payload Sub-structures Validation
    const sim = body.telemetry || {};
    const env = body.environment || {};
    const health = body.health || {};

    if (typeof sim !== "object" || Array.isArray(sim)) {
      validationErrors.push("'telemetry' must be a JSON object containing sensor readings");
    }
    if (typeof env !== "object" || Array.isArray(env)) {
      validationErrors.push("'environment' must be a JSON object");
    }
    if (typeof health !== "object" || Array.isArray(health)) {
      validationErrors.push("'health' must be a JSON object");
    }

    // 4. Physical Sensor Plausibility Range Checks
    // Required core HVAC sensors
    validateNumericRange("telemetry.supplyAirTemperature", sim.supplyAirTemperature, -30.0, 80.0, "°C", true, validationErrors);
    validateNumericRange("telemetry.refrigerantPressure", sim.refrigerantPressure, 0.0, 40.0, " bar", true, validationErrors);
    validateNumericRange("telemetry.compressorCurrent", sim.compressorCurrent, 0.0, 120.0, " A", true, validationErrors);

    // Optional physical sensor metrics
    validateNumericRange("telemetry.filterDP", sim.filterDP, 0.0, 5000.0, " Pa", false, validationErrors);
    validateNumericRange("telemetry.powerConsumption", sim.powerConsumption, 0.0, 250.0, " kW", false, validationErrors);
    validateNumericRange("telemetry.vibration", sim.vibration, 0.0, 100.0, " mm/s", false, validationErrors);
    validateNumericRange("telemetry.remainingUsefulLife", sim.remainingUsefulLife, 0.0, 200000.0, " hrs", false, validationErrors);

    // Environmental readings
    validateNumericRange("environment.supplyVoltage", env.supplyVoltage, 100.0, 600.0, " V", false, validationErrors);
    validateNumericRange("environment.humidity", env.humidity, 0.0, 100.0, "%", false, validationErrors);
    validateNumericRange("environment.operatingHours", env.operatingHours, 0.0, 500000.0, " hrs", false, validationErrors);
    validateNumericRange("environment.ambientTemperature", env.ambientTemperature, -40.0, 70.0, "°C", false, validationErrors);

    // Health score
    validateNumericRange("health.healthScore", health.healthScore, 0.0, 100.0, "%", false, validationErrors);

    // Asset state enums
    if (body.assetState) {
      const stateUpper = String(body.assetState).toUpperCase();
      if (!VALID_ASSET_STATES.includes(stateUpper)) {
        validationErrors.push(`'assetState' must be one of: ${VALID_ASSET_STATES.join(", ")}`);
      }
    }

    if (health.healthStatus) {
      const statusUpper = String(health.healthStatus).toUpperCase();
      if (!VALID_HEALTH_STATUSES.includes(statusUpper)) {
        validationErrors.push(`'health.healthStatus' must be one of: ${VALID_HEALTH_STATUSES.join(", ")}`);
      }
    }

    // Return 400 if any validations failed
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Telemetry validation failed",
        errors: validationErrors,
      });
    }

    // 5. Verify asset exists in DB
    const asset = await assetModel.findAssetByCode(assetCode);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: `No registered asset found for code '${assetCode}'. Register asset in asset registry before streaming telemetry.`,
      });
    }

    // 6. Build clean reading object without hardcoded default mocks
    const reading = {
      recordedAt,
      temperature: Number(sim.supplyAirTemperature),
      pressure: Number(sim.refrigerantPressure),
      vibration: sim.vibration != null ? Number(sim.vibration) : null,
      filterDP: sim.filterDP != null ? Number(sim.filterDP) : null,
      coolingCapacity: sim.coolingCapacity != null ? Number(sim.coolingCapacity) : null,
      compressorWear: sim.compressorWear != null ? Number(sim.compressorWear) : null,
      motorWear: sim.motorWear != null ? Number(sim.motorWear) : null,
      current: Number(sim.compressorCurrent),
      voltage: env.supplyVoltage != null ? Number(env.supplyVoltage) : null,
      humidity: env.humidity != null ? Number(env.humidity) : null,
      power: sim.powerConsumption != null ? Number(sim.powerConsumption) : null,
      operatingHours: env.operatingHours != null ? Number(env.operatingHours) : null,
      assetState: body.assetState ? String(body.assetState).toUpperCase() : "NOMINAL",
    };

    const saved = await telemetryModel.persistSimulationReading(asset.id, reading, body);

    res.status(201).json({
      success: true,
      message: "Telemetry saved successfully",
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
const getLatest = async (req, res) => {
  try {
    const rows = await telemetryModel.getLatestPerAsset();
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

    const rows = await telemetryModel.getHistoryForAsset(asset.id, limit);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Failed to fetch telemetry history:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch telemetry history" });
  }
};

// GET /api/telemetry/predictions/latest
// Retrieve newest AI-computed RUL and health predictions with explainability
const aiPredictionService = require("../services/aiPredictionService");

const getPredictions = async (req, res) => {
  try {
    const predictions = await aiPredictionService.getLatestPredictions();
    res.status(200).json({ success: true, count: predictions.length, data: predictions });
  } catch (error) {
    console.error("❌ Failed to fetch latest predictions:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch predictions" });
  }
};


// POST /api/telemetry/predictions/run
// Runs live Random Forest / physics-informed inference pipeline on demand
const runPredictions = async (req, res) => {
  try {
    const { assetCodes } = req.body || {};
    const result = await aiPredictionService.runPredictionPipeline(
      Array.isArray(assetCodes) ? assetCodes : null
    );
    res.status(200).json({
      success: true,
      message: "AI RUL prediction pipeline executed successfully",
      ...result,
    });
  } catch (error) {
    console.error("❌ Failed to execute prediction pipeline:", error.message);
    res.status(500).json({ success: false, message: error.message || "Prediction execution failed" });
  }
};

module.exports = {
  receiveTelemetry,
  getLatest,
  getHistory,
  getPredictions,
  runPredictions,
};

