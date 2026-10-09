const pool = require("../config/db");

// Save one sensor reading. assetId here is the internal numeric DB id
// (already resolved from the asset_code), not the string code.
const insertTelemetry = async (assetId, reading, rawPayload, client = pool) => {
  const {
    recordedAt,
    temperature,
    pressure,
    vibration,
    current,
    voltage,
    humidity,
    power,
    operatingHours,
    assetState,
    filterDP,
    coolingCapacity,
    compressorWear,
    motorWear,
  } = reading;

  const result = await client.query(
    `INSERT INTO telemetry
      (asset_id, recorded_at, temperature, pressure, vibration,
       current, voltage, humidity, power, operating_hours,
       asset_state, filter_dp, cooling_capacity, compressor_wear, motor_wear, raw_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      assetId,
      recordedAt || new Date(),
      temperature,
      pressure,
      vibration,
      current,
      voltage,
      humidity,
      power,
      operatingHours,
      assetState,
      filterDP != null ? filterDP : null,
      coolingCapacity != null ? coolingCapacity : null,
      compressorWear != null ? compressorWear : null,
      motorWear != null ? motorWear : null,
      rawPayload,
    ]
  );

  return result.rows[0];
};

// Persist the raw simulator reading and its derived prediction/events as one
// transaction. This keeps retries from producing a telemetry row without the
// matching prediction record.
const persistSimulationReading = async (assetId, reading, rawPayload) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const telemetry = await insertTelemetry(assetId, reading, rawPayload, client);
    const healthScore = Number(rawPayload.health?.healthScore);
    const rulHours = Number(rawPayload.telemetry?.remainingUsefulLife);

    if (Number.isFinite(healthScore) || Number.isFinite(rulHours)) {
      const safeHealth = Number.isFinite(healthScore) ? healthScore : null;
      // Primary AI Risk Classification based strictly on RUL
      const riskLevel = Number.isFinite(rulHours)
        ? (rulHours < 150 ? "CRITICAL"
          : rulHours < 500 ? "HIGH"
          : rulHours < 1000 ? "MEDIUM"
          : "NOMINAL")
        : (Number.isFinite(healthScore)
          ? (healthScore < 40 ? "CRITICAL"
            : healthScore < 60 ? "HIGH"
            : healthScore < 80 ? "MEDIUM"
            : "NOMINAL")
          : null);

      await client.query(
        `INSERT INTO predictions (asset_id, telemetry_id, health_score, rul_hours, risk_level, model_version)
         VALUES ($1, $2, $3, $4, $5, 'physics-v1')`,
        [assetId, telemetry.id, safeHealth, Number.isFinite(rulHours) ? rulHours : null, riskLevel]
      );
    }

    // Rule-Based Operational Threshold Checks (with duplicate alert prevention)
    const sim = rawPayload.telemetry || {};
    const tempVal = reading.temperature;
    const pressVal = reading.pressure;
    const filterDPVal = reading.filterDP;
    const currentVal = reading.current;

    const ruleChecks = [];

    // Critical: Very low refrigerant pressure (< 3.8 bar)
    if (pressVal != null && pressVal < 3.8) {
      ruleChecks.push({
        level: "critical",
        title: "Low Refrigerant Pressure",
        message: `Refrigerant circuit pressure dropped to ${pressVal} bar (nominal >= 4.2 bar). Potential micro-leak or compressor suction fault.`,
      });
    }

    // Warning: Elevated supply air temperature (> 25.5°C)
    if (tempVal != null && tempVal > 25.5) {
      ruleChecks.push({
        level: "warning",
        title: "Elevated Supply Air Temperature",
        message: `Supply air temperature reached ${tempVal}°C above design comfort limit. Cooling performance degraded.`,
      });
    }

    // Warning: High filter differential pressure (> 280 Pa)
    if (filterDPVal != null && filterDPVal > 280) {
      ruleChecks.push({
        level: "warning",
        title: "High Filter Differential Pressure",
        message: `Filter differential pressure at ${filterDPVal} Pa indicates particulate clogging. Filter replacement turnaround recommended.`,
      });
    }

    // Warning: High compressor current draw (> 18.0 A)
    if (currentVal != null && currentVal > 18.0) {
      ruleChecks.push({
        level: "warning",
        title: "High Compressor Current Overdraw",
        message: `Compressor motor drawing ${currentVal} A exceeding nominal load limits due to mechanical bearing wear.`,
      });
    }

    for (const rule of ruleChecks) {
      await client.query(
        `INSERT INTO alerts (asset_id, level, title, message, source)
         SELECT $1, $2, $3, $4, 'rule'
         WHERE NOT EXISTS (
           SELECT 1 FROM alerts
           WHERE asset_id = $1 AND title = $3 AND source = 'rule' AND is_resolved = FALSE
         )`,
        [assetId, rule.level, rule.title, rule.message]
      );
    }

    // Process simulator events if emitted
    for (const event of Array.isArray(rawPayload.events) ? rawPayload.events : []) {
      if (!event?.eventType) continue;
      const level = event.severity === "CRITICAL" ? "critical"
        : event.severity === "WARNING" ? "warning" : "info";
      const title = String(event.eventType).replace(/_/g, " ");
      await client.query(
        `INSERT INTO alerts (asset_id, level, title, message, source)
         SELECT $1, $2, $3, $4, 'rule'
         WHERE NOT EXISTS (
           SELECT 1 FROM alerts
           WHERE asset_id = $1 AND title = $3 AND source = 'rule' AND is_resolved = FALSE
         )`,
        [assetId, level, title, `Simulator detected ${title.toLowerCase()}.`]
      );
    }

    // Automatically sync asset status in the registry based on simulator health & state
    let autoStatus = "OPERATIONAL";
    const simState = String(rawPayload.assetState || reading.assetState || "").toUpperCase();
    if (simState === "WARNING" || (Number.isFinite(healthScore) && healthScore < 75 && healthScore >= 40)) {
      autoStatus = "WARNING";
    } else if (simState === "CRITICAL" || simState === "ALARM" || simState === "OFFLINE" || (Number.isFinite(healthScore) && healthScore < 40)) {
      autoStatus = "OFFLINE";
    } else if (simState === "MAINTENANCE") {
      autoStatus = "MAINTENANCE";
    } else {
      autoStatus = "OPERATIONAL";
    }

    await client.query(
      `UPDATE assets
       SET status = $1,
           updated_at = NOW()
       WHERE id = $2 AND status NOT IN ('MAINTENANCE', 'DECOMMISSIONED')`,
      [autoStatus, assetId]
    );

    await client.query("COMMIT");
    return telemetry;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// One newest reading per asset — for dashboard overview cards.
const getLatestPerAsset = async () => {
  const result = await pool.query(
    `SELECT DISTINCT ON (t.asset_id)
        t.*, a.asset_code, a.name AS asset_name, a.zone,
        CASE
          WHEN t.recorded_at >= NOW() - INTERVAL '30 seconds' THEN 'LIVE'
          WHEN t.recorded_at >= NOW() - INTERVAL '5 minutes' THEN 'STALE'
          ELSE 'OFFLINE'
        END AS telemetry_status,
        p.rul_hours AS predicted_rul_hours,
        p.health_score AS predicted_health_score,
        p.risk_level, p.model_version, p.predicted_at
     FROM telemetry t
     JOIN assets a ON a.id = t.asset_id
     LEFT JOIN coaches c ON a.coach_id = c.id
     LEFT JOIN trains tr ON c.train_id = tr.id
     LEFT JOIN LATERAL (
         SELECT rul_hours, health_score, risk_level, model_version, predicted_at
         FROM predictions p WHERE p.asset_id = t.asset_id
         ORDER BY p.predicted_at DESC, p.id DESC LIMIT 1
       ) p ON TRUE
     ORDER BY t.asset_id, t.recorded_at DESC`
  );
  return result.rows;
};

// Recent history for one asset (for charts / trend lines).
const getHistoryForAsset = async (assetId, limit = 100) => {
  const result = await pool.query(
    `SELECT * FROM telemetry
     WHERE asset_id = $1
     ORDER BY recorded_at DESC
     LIMIT $2`,
    [assetId, limit]
  );
  return result.rows;
};

module.exports = {
  insertTelemetry,
  persistSimulationReading,
  getLatestPerAsset,
  getHistoryForAsset,
};
