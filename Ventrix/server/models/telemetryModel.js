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
  } = reading;

  const result = await client.query(
    `INSERT INTO telemetry
      (asset_id, recorded_at, temperature, pressure, vibration,
       current, voltage, humidity, power, operating_hours,
       asset_state, raw_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
      const riskLevel = !Number.isFinite(healthScore) ? null
        : healthScore < 40 ? "CRITICAL"
          : healthScore < 60 ? "HIGH"
            : healthScore < 80 ? "MEDIUM" : "LOW";
      await client.query(
        `INSERT INTO predictions (asset_id, telemetry_id, health_score, rul_hours, risk_level, model_version)
         VALUES ($1, $2, $3, $4, $5, 'physics-v1')`,
        [assetId, telemetry.id, safeHealth, Number.isFinite(rulHours) ? rulHours : null, riskLevel]
      );
    }

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

    await client.query("COMMIT");
    return telemetry;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// One newest reading per asset — this is what the dashboard's
// "overview" cards will use. organizationId scopes results for
// customer-role callers; pass null (Ventrix staff) to see everything.
const getLatestPerAsset = async (organizationId = null) => {
  const result = await pool.query(
    `SELECT DISTINCT ON (t.asset_id)
        t.*, a.asset_code, a.name AS asset_name, a.zone,
        p.rul_hours AS predicted_rul_hours,
        p.health_score AS predicted_health_score,
        p.risk_level, p.model_version, p.predicted_at
     FROM telemetry t
     JOIN assets a ON a.id = t.asset_id
     LEFT JOIN coaches c ON a.coach_id = c.id
     LEFT JOIN trains tr ON c.train_id = tr.id
     LEFT JOIN projects pj ON tr.project_id = pj.id
     LEFT JOIN LATERAL (
         SELECT rul_hours, health_score, risk_level, model_version, predicted_at
         FROM predictions p WHERE p.asset_id = t.asset_id
         ORDER BY p.predicted_at DESC, p.id DESC LIMIT 1
       ) p ON TRUE
     WHERE ($1::int IS NULL OR pj.organization_id = $1)
     ORDER BY t.asset_id, t.recorded_at DESC`,
    [organizationId]
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
