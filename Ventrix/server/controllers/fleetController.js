const pool = require("../config/db");
const { isCustomerRole } = require("../middleware/roles");

// Helper to determine aggregated coach health status
function computeCoachHealth(hvacUnits = []) {
  if (!hvacUnits || hvacUnits.length === 0) return { status: "NOMINAL", healthScore: 100, badge: "HEALTHY" };
  
  let minHealth = 100;
  let hasCritical = false;
  let hasWarning = false;
  let hasMaintenance = false;

  for (const unit of hvacUnits) {
    const health = unit.health_score != null ? Number(unit.health_score) : 95;
    if (health < minHealth) minHealth = health;

    const st = String(unit.status || "").toUpperCase();
    if (st === "OFFLINE" || st === "ALARM" || st === "CRITICAL" || health < 50) {
      hasCritical = true;
    } else if (st === "WARNING" || health < 75) {
      hasWarning = true;
    } else if (st === "MAINTENANCE") {
      hasMaintenance = true;
    }
  }

  if (hasCritical) {
    return { status: "CRITICAL", healthScore: Math.round(minHealth), badge: "CRITICAL" };
  }
  if (hasWarning) {
    return { status: "WARNING", healthScore: Math.round(minHealth), badge: "WARNING" };
  }
  if (hasMaintenance) {
    return { status: "MAINTENANCE", healthScore: Math.round(minHealth), badge: "MAINTENANCE" };
  }
  return { status: "OPERATIONAL", healthScore: Math.round(minHealth), badge: "NOMINAL" };
}

// GET /api/fleet/hierarchy
// Full Fleet -> Trains -> Coaches -> HVAC Units hierarchy
const getFleetHierarchy = async (req, res) => {
  try {
    // 1. Fetch trains
    const trainRows = await pool.query(
      `SELECT t.id, t.train_number, t.train_name, t.status
       FROM trains t
       ORDER BY t.train_number ASC`
    );

    if (trainRows.rows.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const trainIds = trainRows.rows.map((r) => r.id);

    // 2. Fetch coaches belonging to these trains
    const coachRows = await pool.query(
      `SELECT c.id, c.train_id, c.coach_number, c.coach_type, c.status
       FROM coaches c
       WHERE c.train_id = ANY($1::int[])
       ORDER BY c.coach_number ASC`,
      [trainIds]
    );

    const coachIds = coachRows.rows.map((c) => c.id);

    // 3. Fetch assets attached to these coaches along with latest telemetry & predictions
    const assetRows = coachIds.length > 0 ? await pool.query(
      `SELECT a.id, a.asset_code, a.name, a.zone, a.status, a.coach_id,
              a.serial_number, a.install_date,
              p.rul_hours, p.health_score, p.risk_level,
              t.temperature, t.pressure, t.current, t.voltage, t.humidity, t.power, t.vibration,
              t.recorded_at,
              COALESCE(al.alert_count, 0)::int AS active_alerts_count,
              COALESCE(wo.wo_count, 0)::int AS open_work_orders_count
       FROM assets a
       LEFT JOIN LATERAL (
         SELECT rul_hours, health_score, risk_level
         FROM predictions pred
         WHERE pred.asset_id = a.id
         ORDER BY pred.predicted_at DESC, pred.id DESC LIMIT 1
       ) p ON TRUE
       LEFT JOIN LATERAL (
         SELECT temperature, pressure, current, voltage, humidity, power, vibration, recorded_at
         FROM telemetry tel
         WHERE tel.asset_id = a.id
         ORDER BY tel.recorded_at DESC LIMIT 1
       ) t ON TRUE
       LEFT JOIN (
         SELECT asset_id, COUNT(*) AS alert_count
         FROM alerts
         WHERE is_resolved = FALSE
         GROUP BY asset_id
       ) al ON al.asset_id = a.id
       LEFT JOIN (
         SELECT asset_id, COUNT(*) AS wo_count
         FROM work_orders
         WHERE status NOT IN ('COMPLETED', 'CLOSED', 'CANCELLED')
         GROUP BY asset_id
       ) wo ON wo.asset_id = a.id
       WHERE a.coach_id = ANY($1::int[])
       ORDER BY a.asset_code ASC`,
      [coachIds]
    ) : { rows: [] };

    // Group assets by coach_id
    const assetsByCoach = {};
    for (const asset of assetRows.rows) {
      if (!assetsByCoach[asset.coach_id]) {
        assetsByCoach[asset.coach_id] = [];
      }
      assetsByCoach[asset.coach_id].push(asset);
    }

    // Group coaches by train_id
    const coachesByTrain = {};
    for (const coach of coachRows.rows) {
      const hvacUnits = assetsByCoach[coach.id] || [];
      const coachHealth = computeCoachHealth(hvacUnits);

      if (!coachesByTrain[coach.train_id]) {
        coachesByTrain[coach.train_id] = [];
      }
      coachesByTrain[coach.train_id].push({
        ...coach,
        health: coachHealth,
        hvac_units: hvacUnits,
      });
    }

    // Assemble final train list
    const result = trainRows.rows.map((train) => {
      const coaches = coachesByTrain[train.id] || [];
      const totalUnits = coaches.reduce((sum, c) => sum + c.hvac_units.length, 0);
      const criticalCoaches = coaches.filter((c) => c.health.status === "CRITICAL").length;
      const warningCoaches = coaches.filter((c) => c.health.status === "WARNING").length;

      return {
        ...train,
        coaches,
        stats: {
          totalCoaches: coaches.length,
          totalHvacUnits: totalUnits,
          criticalCoaches,
          warningCoaches,
          overallHealth: coaches.length > 0
            ? Math.round(coaches.reduce((s, c) => s + c.health.healthScore, 0) / coaches.length)
            : 100,
        },
      };
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("❌ Failed to fetch fleet hierarchy:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch fleet hierarchy" });
  }
};

// GET /api/fleet/coaches/:id/twin
// Detailed coach digital twin state with paired HVAC units and environmental conditions
const getCoachDigitalTwin = async (req, res) => {
  try {
    const coachId = Number(req.params.id);
    if (!coachId) {
      return res.status(400).json({ success: false, message: "Valid coach id is required" });
    }

    const coachRes = await pool.query(
      `SELECT c.*, t.train_number, t.train_name, p.name AS project_name
       FROM coaches c
       JOIN trains t ON c.train_id = t.id
       JOIN projects p ON t.project_id = p.id
       WHERE c.id = $1`,
      [coachId]
    );

    if (coachRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Coach not found" });
    }

    const coach = coachRes.rows[0];

    // Fetch HVAC units installed on this coach
    const assetsRes = await pool.query(
      `SELECT a.*,
              pr.product_code, pr.name AS product_name, pr.specifications,
              p.rul_hours, p.health_score, p.risk_level, p.model_version,
              t.temperature, t.pressure, t.current, t.voltage, t.humidity, t.power, t.vibration,
              t.operating_hours, t.asset_state, t.recorded_at,
              COALESCE(al.alert_count, 0)::int AS active_alerts_count,
              COALESCE(wo.wo_count, 0)::int AS open_work_orders_count
       FROM assets a
       LEFT JOIN products pr ON a.product_id = pr.id
       LEFT JOIN LATERAL (
         SELECT rul_hours, health_score, risk_level, model_version
         FROM predictions pred
         WHERE pred.asset_id = a.id
         ORDER BY pred.predicted_at DESC, pred.id DESC LIMIT 1
       ) p ON TRUE
       LEFT JOIN LATERAL (
         SELECT temperature, pressure, current, voltage, humidity, power, vibration, operating_hours, asset_state, recorded_at
         FROM telemetry tel
         WHERE tel.asset_id = a.id
         ORDER BY tel.recorded_at DESC LIMIT 1
       ) t ON TRUE
       LEFT JOIN (
         SELECT asset_id, COUNT(*) AS alert_count
         FROM alerts
         WHERE is_resolved = FALSE
         GROUP BY asset_id
       ) al ON al.asset_id = a.id
       LEFT JOIN (
         SELECT asset_id, COUNT(*) AS wo_count
         FROM work_orders
         WHERE status NOT IN ('COMPLETED', 'CLOSED', 'CANCELLED')
         GROUP BY asset_id
       ) wo ON wo.asset_id = a.id
       WHERE a.coach_id = $1
       ORDER BY a.asset_code ASC`,
      [coachId]
    );

    const units = assetsRes.rows;
    const coachHealth = computeCoachHealth(units);

    // Identify End A (Unit 1) and End B (Unit 2)
    const endAUnit = units.find((u) => u.zone && u.zone.includes("End A")) || units[0] || null;
    const endBUnit = units.find((u) => u.zone && u.zone.includes("End B")) || units[1] || null;

    // Compute cabin average temperature & differential
    const tempA = endAUnit?.temperature != null ? Number(endAUnit.temperature) : 22.0;
    const tempB = endBUnit?.temperature != null ? Number(endBUnit.temperature) : 22.5;
    const avgCabinTemp = Number(((tempA + tempB) / 2).toFixed(1));
    const thermalGradient = Math.abs(Number((tempA - tempB).toFixed(1)));

    res.status(200).json({
      success: true,
      data: {
        coach,
        health: coachHealth,
        units,
        endAUnit,
        endBUnit,
        thermalAnalysis: {
          avgCabinTemp,
          thermalGradient,
          targetSetpoint: 24.0,
          airflowStatus: thermalGradient > 3.0 ? "UNEVEN" : "BALANCED",
        },
      },
    });
  } catch (error) {
    console.error("❌ Failed to fetch coach digital twin:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch coach digital twin" });
  }
};

module.exports = {
  getFleetHierarchy,
  getCoachDigitalTwin,
};
