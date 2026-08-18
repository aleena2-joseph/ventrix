/**
 * generateTrainingDataset.js
 * ---------------------------------------------------------------
 * This is what the original codebase was missing: a way to produce
 * a large, correctly-labeled dataset for ML training.
 *
 * The live SimulationEngine (index.js) is great for a demo dashboard,
 * but it runs at 1 tick/sec via setInterval -- generating 500K rows
 * that way would take days of wall-clock time, and even then the
 * live RUL field is only an ESTIMATE (HVACRUL.js), not ground truth.
 *
 * This script instead:
 *   1. Fast-forwards simulated time (no setInterval, tight loop).
 *   2. Runs each unit all the way to ACTUAL failure (health = 0).
 *   3. Back-labels every row with the TRUE remaining time until that
 *      unit's real failure -- this is how NASA's CMAPSS turbofan
 *      dataset is built, and it's the correct way to generate RUL
 *      training labels from a simulator.
 *   4. Varies design life + random environment seed per unit so the
 *      dataset contains diverse degradation trajectories, not one
 *      repeated pattern (critical -- a model trained on a single
 *      life history will not generalize to new units).
 *
 * Usage:
 *   node generateTrainingDataset.js [numUnits] [dtHoursPerTick] [maxHours]
 *
 * Example:
 *   node generateTrainingDataset.js 80 0.25 30000
 *   -> 80 units, 15-minute resolution, hard cap at 30,000 operating hours
 *
 * Output:
 *   training_data/telemetry.csv
 */

const fs = require("fs");
const path = require("path");

const EnvironmentModel = require("./environment/EnvironmentModel");
const MonteCarloEngine = require("./montecarlo/MonteCarloEngine");
const HVACAsset = require("./assets/hvac/HVACAsset");

const NUM_UNITS = parseInt(process.argv[2] || "60", 10);
const DT_HOURS = parseFloat(process.argv[3] || "0.25"); // simulated hours advanced per tick
const MAX_HOURS = parseFloat(process.argv[4] || "30000"); // safety cap
const OUT_DIR = path.join(__dirname, "training_data");
const OUT_PATH = path.join(OUT_DIR, "telemetry.csv");

// The health formula's temperature component has a physical floor (supply
// air temperature can't exceed the model's fixed return-air constant), so
// health asymptotes just above 0 rather than hitting it exactly. 5 is the
// "effectively failed / requires immediate replacement" threshold -- this
// mirrors how real RUL datasets (e.g., CMAPSS) define end-of-life as a
// degradation threshold, not literal zero.
// (Verified empirically: with filter/cooling/compressor all fully failed,
// the health formula floors at exactly 6 -- because HVACPhysics models
// return-air temperature as a fixed constant even at total cooling
// failure, so the temperature health component never drops below 40.
// 6 is therefore the correct "fully failed" threshold for this model.)
const FAILURE_HEALTH_THRESHOLD = 6;

function simulateUnitLifecycle(unitIndex) {
    const monteCarlo = new MonteCarloEngine();
    const environment = new EnvironmentModel();
    environment.setEnvironment(monteCarlo.generateEnvironment());

    // Vary design life per unit (15k-25k hours) so the dataset has a
    // realistic spread of lifespans rather than one fixed value.
    const designLife = 15000 + Math.random() * 10000;
    const asset = new HVACAsset(`HVAC-${String(unitIndex).padStart(4, "0")}`, designLife);

    const rows = [];
    let failed = false;

    while (!failed && environment.getEnvironment().operatingHours < MAX_HOURS) {
        environment.update(DT_HOURS * 3600); // API takes seconds
        environment.evolve();
        const env = environment.getEnvironment();

        const packet = asset.update(env);
        const t = packet.telemetry;

        rows.push({
            asset_id: packet.assetId,
            asset_state: packet.assetState,
            operating_hours: t.operatingHours,
            ambient_temperature: env.ambientTemperature,
            humidity: env.humidity,
            passenger_count: env.passengerCount,
            train_speed: env.trainSpeed,
            supply_voltage: env.supplyVoltage,
            supply_air_temperature: t.supplyAirTemperature,
            refrigerant_pressure: t.refrigerantPressure,
            compressor_current: t.compressorCurrent,
            filter_dp: t.filterDP,
            cooling_capacity: t.coolingCapacity,
            power_consumption: t.powerConsumption,
            compressor_wear: t.compressorWear,
            motor_wear: t.motorWear,
            refrigerant_charge: t.refrigerantCharge,
            health_score: packet.health.healthScore,
            health_status: packet.health.healthStatus,
            active_events: packet.events.map(e => e.eventType).join("|") || "none",
        });

        if (packet.health.healthScore <= FAILURE_HEALTH_THRESHOLD) {
            failed = true;
        }
    }

    // ---- Backward RUL labeling: the ground truth ----
    const failureHour = rows.length ? rows[rows.length - 1].operating_hours : 0;
    for (const row of rows) {
        row.remaining_useful_life = Math.max(0, Number((failureHour - row.operating_hours).toFixed(2)));
    }

    return rows;
}

function toCSV(rows) {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(",")];
    for (const row of rows) {
        lines.push(headers.map(h => row[h]).join(","));
    }
    return lines.join("\n");
}

function main() {
    console.log(`Generating training dataset: ${NUM_UNITS} units, ${DT_HOURS}h/tick, cap ${MAX_HOURS}h`);
    console.log("This runs each unit to actual failure -- may take a minute.\n");

    fs.mkdirSync(OUT_DIR, { recursive: true });

    const allRows = [];
    for (let i = 0; i < NUM_UNITS; i++) {
        const rows = simulateUnitLifecycle(i);
        allRows.push(...rows);
        const last = rows[rows.length - 1];
        console.log(`  HVAC-${String(i).padStart(4, "0")}: failed at ${last.operating_hours}h  (${rows.length} rows)`);
    }

    fs.writeFileSync(OUT_PATH, toCSV(allRows));
    console.log(`\nSaved ${allRows.length} total rows -> ${OUT_PATH}`);
    console.log("This CSV is ready for feature engineering + Random Forest training.");
}

main();
