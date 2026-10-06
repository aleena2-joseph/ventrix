/**
 * aiPredictionService.js
 * ---------------------------------------------------------------
 * Core AI Predictive Service for Ventrix Railway HVAC Platform.
 * 
 * Flow:
 *   1. Queries recent telemetry history per asset from PostgreSQL.
 *   2. Invokes the Random Forest model via Python child process:
 *        python predict.py --stdin
 *   3. If Python is unavailable, applies resilient physics-informed
 *      fallbacks so platform operation is never blocked.
 *   4. Persists RUL predictions, risk levels, and model metadata into
 *      the 'predictions' database table.
 *   5. Generates prescriptive explainability advisories (why RUL is low).
 *   6. Synchronizes asset health scores and auto-triggers critical alerts.
 */

const { spawn } = require("child_process");
const path = require("path");
const pool = require("../config/db");

const PYTHON_SCRIPT_PATH = path.resolve(
  __dirname,
  "../../../Railway-Simulation/hvac_fix/predict.py"
);

/**
 * Determine risk level based on standard Ventrix unified thresholds:
 *   CRITICAL: RUL < 150h or Health < 40%
 *   HIGH:     150h - 500h or Health < 60%
 *   MEDIUM:   500h - 1000h or Health < 80%
 *   NOMINAL:  RUL >= 1000h and Health >= 80%
 */
function classifyRiskLevel(rulHours, healthScore) {
  const rul = Number(rulHours);
  const health = Number(healthScore);

  if (rul < 150 || health < 40) return "CRITICAL";
  if (rul < 500 || health < 60) return "HIGH";
  if (rul < 1000 || health < 80) return "MEDIUM";
  return "NOMINAL";
}

/**
 * Generate explainability diagnostics explaining the primary drivers of degradation.
 */
function generateExplainability(record, rul, risk) {
  const drivers = [];
  const filterDP = Number(record.filter_dp || record.filterDP || 120);
  const current = Number(record.compressor_current || record.current || 14);
  const temp = Number(record.supply_air_temperature || record.temperature || 21);
  const press = Number(record.refrigerant_pressure || record.pressure || 4.8);
  const wear = Number(record.compressor_wear || 0);

  if (filterDP > 250) {
    drivers.push(`Elevated filter differential pressure (${filterDP} Pa) indicates significant particulate clogging.`);
  }
  if (current > 16.5) {
    drivers.push(`Compressor current draw elevated (${current} A) due to mechanical wear and motor winding resistance.`);
  }
  if (press < 4.0) {
    drivers.push(`Low refrigerant circuit pressure (${press} bar) indicates potential refrigerant leakage.`);
  }
  if (temp > 24.5) {
    drivers.push(`Thermal output degraded: supply air temperature at ${temp}°C above nominal setpoint.`);
  }
  if (wear > 0.4) {
    drivers.push(`Mechanical compressor bearing and seal wear accumulated (${(wear * 100).toFixed(0)}%).`);
  }

  let recommendation;
  if (risk === "CRITICAL") {
    recommendation = `CRITICAL INTERVENTION: RUL below 150h. Immediate depot inspection required. ${drivers.join(" ")}`;
  } else if (risk === "HIGH") {
    recommendation = `HIGH WEAR ADVISORY: Service turnaround required within 72 hours. Replace return air filters and inspect TXV valve.`;
  } else if (risk === "MEDIUM") {
    recommendation = `ROUTINE ATTENTION: Schedule preventive filter and coil cleaning during next scheduled turnaround.`;
  } else {
    recommendation = `OPTIMAL OPERATION: All thermodynamic parameters within nominal design limits. No immediate action required.`;
  }

  return {
    drivers: drivers.length > 0 ? drivers : ["Nominal operating parameters across all sensors."],
    recommendation,
  };
}

/**
 * Executes python predict.py --stdin via child_process.
 */
function runPythonInference(inputRecords) {
  return new Promise((resolve, reject) => {
    let outputData = "";
    let errorData = "";

    const pythonBin = process.platform === "win32" ? "python" : "python3";
    const pyProcess = spawn(pythonBin, [PYTHON_SCRIPT_PATH, "--stdin"], {
      windowsHide: true,
    });

    pyProcess.stdout.on("data", (data) => {
      outputData += data.toString();
    });

    pyProcess.stderr.on("data", (data) => {
      errorData += data.toString();
    });

    pyProcess.on("close", (code) => {
      if (code !== 0 || !outputData.trim()) {
        return reject(
          new Error(`Python inference failed (code ${code}): ${errorData || "No output"}`)
        );
      }
      try {
        const parsed = JSON.parse(outputData.trim());
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Failed to parse Python JSON output: ${err.message}`));
      }
    });

    pyProcess.on("error", (err) => {
      reject(new Error(`Could not spawn Python executable: ${err.message}`));
    });

    // Write input JSON to stdin
    pyProcess.stdin.write(JSON.stringify(inputRecords));
    pyProcess.stdin.end();
  });
}

/**
 * Resilient fallback heuristic if Python environment is unavailable.
 */
function computeFallbackRUL(record) {
  const health = Number(record.health_score || 90);
  const hours = Number(record.operating_hours || 1000);
  const designLife = 20000;
  const remainingBudget = Math.max(0, designLife - hours);

  const factor = Math.max(0.01, health / 100);
  const rulHours = Math.round(Math.min(remainingBudget, remainingBudget * factor));
  const risk = classifyRiskLevel(rulHours, health);

  return {
    asset_id: record.asset_id,
    predicted_rul: rulHours,
    predicted_days: Number((rulHours / 24).toFixed(1)),
    risk_level: risk,
    health_score: health,
    model_version: "physics-heuristic-v1",
  };
}

/**
 * Core function: runs the prediction pipeline across all assets or specified assetCodes.
 */
async function runPredictionPipeline(assetCodes = null) {
  // 1. Fetch latest telemetry row for each asset
  const query = `
    SELECT DISTINCT ON (t.asset_id)
      t.id AS telemetry_id,
      t.asset_id,
      a.asset_code,
      a.name AS asset_name,
      t.recorded_at,
      t.temperature,
      t.pressure,
      t.current,
      t.voltage,
      t.humidity,
      t.power,
      t.operating_hours,
      t.asset_state,
      t.raw_payload
    FROM telemetry t
    JOIN assets a ON a.id = t.asset_id
    WHERE ($1::text[] IS NULL OR a.asset_code = ANY($1))
    ORDER BY t.asset_id, t.recorded_at DESC
  `;

  const { rows } = await pool.query(query, [assetCodes]);
  if (!rows || rows.length === 0) {
    return { success: true, count: 0, predictions: [] };
  }

  // 2. Format input records for model inference
  const inputRecords = rows.map((r) => {
    const raw = r.raw_payload || {};
    const sim = raw.telemetry || {};
    const env = raw.environment || {};
    const health = raw.health || {};

    return {
      asset_id: r.asset_code,
      telemetry_id: r.telemetry_id,
      db_asset_id: r.asset_id,
      asset_state: r.asset_state || "NOMINAL",
      health_status: health.healthStatus || "NOMINAL",
      operating_hours: Number(r.operating_hours || env.operatingHours || 1000),
      ambient_temperature: Number(env.ambientTemperature || 32.0),
      humidity: Number(r.humidity || env.humidity || 55.0),
      passenger_count: Number(env.passengerCount || 50),
      train_speed: Number(env.trainSpeed || 75.0),
      supply_voltage: Number(r.voltage || env.supplyVoltage || 415.0),
      supply_air_temperature: Number(r.temperature || sim.supplyAirTemperature || 21.0),
      refrigerant_pressure: Number(r.pressure || sim.refrigerantPressure || 4.8),
      compressor_current: Number(r.current || sim.compressorCurrent || 14.0),
      filter_dp: Number(sim.filterDP || 150.0),
      cooling_capacity: Number(sim.coolingCapacity || 35.0),
      power_consumption: Number(r.power || sim.powerConsumption || 10.0),
      compressor_wear: Number(sim.compressorWear || 0.05),
      motor_wear: Number(sim.motorWear || 0.05),
      refrigerant_charge: Number(sim.refrigerantCharge || 1.0),
      health_score: Number(health.healthScore || 90.0),
    };
  });

  // 3. Run Inference (Python model first, fallback on error)
  let rawPredictions = [];
  let modelEngine = "random-forest-v1";

  try {
    const pyResult = await runPythonInference(inputRecords);
    if (pyResult?.success && Array.isArray(pyResult.predictions)) {
      rawPredictions = pyResult.predictions;
      modelEngine = "random-forest-v1";
    } else {
      throw new Error("Invalid output format from Python model");
    }
  } catch (pyErr) {
    console.warn("⚠️ [AIPredictionService] Python Random Forest inference fallback:", pyErr.message);
    rawPredictions = inputRecords.map((rec) => computeFallbackRUL(rec));
    modelEngine = "physics-heuristic-v1";
  }

  // 4. Persist to PostgreSQL and build enriched output
  const finalResults = [];

  for (let i = 0; i < inputRecords.length; i++) {
    const rec = inputRecords[i];
    const pred = rawPredictions.find((p) => p.asset_id === rec.asset_id) || rawPredictions[i];

    const rulHours = Number(pred.predicted_rul);
    const healthScore = Number(pred.health_score || rec.health_score);
    const riskLevel = classifyRiskLevel(rulHours, healthScore);
    const explainability = generateExplainability(rec, rulHours, riskLevel);

    // Save prediction record
    await pool.query(
      `INSERT INTO predictions (asset_id, telemetry_id, health_score, rul_hours, risk_level, model_version, predicted_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [rec.db_asset_id, rec.telemetry_id, healthScore, rulHours, riskLevel, modelEngine]
    );

    // Auto-sync asset health & status if degraded
    if (riskLevel === "CRITICAL") {
      await pool.query(
        `UPDATE assets SET status = 'WARNING', updated_at = NOW() WHERE id = $1 AND status = 'OPERATIONAL'`,
        [rec.db_asset_id]
      );

      // Create an AI predictive alert if one doesn't exist
      await pool.query(
        `INSERT INTO alerts (asset_id, level, title, message, source)
         SELECT $1, 'critical', 'Imminent Failure Predicted (RUL < 150h)', $2, 'ai'
         WHERE NOT EXISTS (
           SELECT 1 FROM alerts
           WHERE asset_id = $1 AND source = 'ai' AND is_resolved = FALSE
         )`,
        [rec.db_asset_id, `AI model predicts remaining useful life of ${rulHours}h. Immediate inspection required.`]
      );
    }

    finalResults.push({
      asset_code: rec.asset_id,
      asset_name: rec.asset_name,
      health_score: healthScore,
      predicted_rul: rulHours,
      predicted_days: Number((rulHours / 24).toFixed(1)),
      risk_level: riskLevel,
      model_version: modelEngine,
      predicted_at: new Date().toISOString(),
      explainability,
      sensors: {
        supply_air_temperature: rec.supply_air_temperature,
        refrigerant_pressure: rec.refrigerant_pressure,
        compressor_current: rec.compressor_current,
        filter_dp: rec.filter_dp,
        power_consumption: rec.power_consumption,
        operating_hours: rec.operating_hours,
      },
    });
  }

  return {
    success: true,
    count: finalResults.length,
    model_version: modelEngine,
    predictions: finalResults,
  };
}

/**
 * Retrieve the latest prediction per asset from the database.
 */
async function getLatestPredictions(organizationId = null) {
  const result = await pool.query(
    `SELECT DISTINCT ON (p.asset_id)
        p.id,
        p.asset_id,
        a.asset_code,
        a.name AS asset_name,
        p.health_score,
        p.rul_hours AS predicted_rul,
        ROUND(p.rul_hours / 24.0, 1) AS predicted_days,
        p.risk_level,
        p.model_version,
        p.predicted_at,
        t.temperature,
        t.pressure,
        t.current,
        t.operating_hours,
        t.raw_payload
     FROM predictions p
     JOIN assets a ON a.id = p.asset_id
     LEFT JOIN telemetry t ON p.telemetry_id = t.id
     LEFT JOIN coaches c ON a.coach_id = c.id
     LEFT JOIN trains tr ON c.train_id = tr.id
     LEFT JOIN projects pj ON tr.project_id = pj.id
     WHERE ($1::int IS NULL OR pj.organization_id = $1)
     ORDER BY p.asset_id, p.predicted_at DESC`
    ,
    [organizationId]
  );

  const enriched = result.rows.map((row) => {
    const raw = row.raw_payload || {};
    const sim = raw.telemetry || {};
    const explain = generateExplainability(
      {
        filter_dp: sim.filterDP,
        compressor_current: row.current,
        supply_air_temperature: row.temperature,
        refrigerant_pressure: row.pressure,
        compressor_wear: sim.compressorWear,
      },
      row.predicted_rul,
      row.risk_level
    );

    return {
      ...row,
      health_score: Number(row.health_score),
      predicted_rul: Number(row.predicted_rul),
      explainability: explain,
    };
  });

  return enriched;
}

module.exports = {
  runPredictionPipeline,
  getLatestPredictions,
  classifyRiskLevel,
  generateExplainability,
};
