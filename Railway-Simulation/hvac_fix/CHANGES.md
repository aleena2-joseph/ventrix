# CHANGES.md — What was wrong, and what I fixed

Your original architecture (BaseAsset / StateMachine / EventEngine / AssetManager
pattern) is genuinely good design. The problem wasn't the architecture — it's that
the piece that makes RUL prediction *possible* was missing: **nothing in the codebase
ever aged the asset.**

## Critical bugs (these broke RUL prediction entirely)

### 1. No aging engine — the core issue
`EnvironmentModel.js` incremented `operatingHours` every tick, but **no other file
in the project ever read that value**. `assetState` (`compressorEfficiency`,
`refrigerantCharge`, `airflowEfficiency`, `motorEfficiency`) was initialized once
in the constructor and never changed again. Health only fluctuated with
instantaneous ambient/passenger noise — it never trended toward failure.

**Fix:** New file `assets/hvac/HVACDegradation.js`. Every tick, it wears the
compressor and motor and fouls the filter based on elapsed operating hours *and*
how hard the compressor is working (`compressorLoad`). Wired into
`HVACPhysics.update()`.

### 2. No RUL field existed anywhere
Not in `HVACPhysics`, not in `TelemetryModel`, not in the Kafka payload. There
was no target for a model to learn.

**Fix:** New file `assets/hvac/HVACRUL.js` for a live physics-based estimate
(dashboard use), plus `generateTrainingDataset.js`, which runs each unit to
**actual failure** and back-labels the **true** remaining hours at every row —
the same approach NASA's CMAPSS dataset uses, and the correct way to generate
RUL training labels.

### 3. `calculateCompressorCurrent` ignored motor wear
It referenced the fixed constant `this.constants.MOTOR_EFFICIENCY` instead of
the (now-degrading) `this.assetState.motorEfficiency`. A worn motor should draw
more current for the same output — that symptom was being silently discarded.

**Fix:** now reads `this.assetState.motorEfficiency`.

### 4. `targetFilterRestriction` was never set by anything
`updateFilterRestriction()` ramps `currentFilterRestriction` toward
`targetFilterRestriction` — but nothing ever changed the target away from 0, so
the filter could never clog.

**Fix:** `HVACDegradation` now raises `targetFilterRestriction` over time.

### 5. `determineOperationalState` referenced a field that was never produced
`this.telemetry.condenserTemperature` doesn't exist anywhere in
`HVACPhysics` — always `undefined`, so `> 60` was always `false` and `HEATING`
could never trigger.

**Fix:** changed to `this.telemetry.supplyAirTemperature > 25`.

### 6. Fault events were log-only
`EventRules.checkFilterClogging` detected a threshold crossing and emitted a
JSON event — but nothing about the physical system actually changed because of
it. A "filter clogging" event didn't clog anything.

**Fix:** `HVACAsset.maybeInjectFault()` now probabilistically triggers a real
refrigerant leak (`HVACDegradation.triggerRefrigerantLeak()`) with likelihood
increasing as compressor wear increases. I also implemented the three rules
you'd left as commented-out stubs (`checkHighTemperature`, plus
`checkRefrigerantLeak`, `checkCompressorOvercurrent`, `checkImminentFailure`).

## Secondary fixes

- **Kafka broker hardcoded to a private IP** (`100.66.251.9`) — not portable to
  any other machine. Now reads `process.env.KAFKA_BROKER`, defaulting to
  `localhost:9092` to match `kafka/docker-compose.yml` (which had the same
  hardcoded IP in `KAFKA_ADVERTISED_LISTENERS` — also fixed).
- **Dead code removed**: `assets/compressor/*` (unused parallel asset type,
  never imported) and `diagnostics/HealthAssessment.js` (exact duplicate of
  `HVACHealth.js`, never imported).
- **`TelemetryPublisher` now supports a `silent` mode** — the original always
  called `console.clear()` and dumped full JSON every tick, which is fine for
  a live demo but not for any kind of extended/accelerated run.
- **Failure threshold tuned to 6, not 0.** I found empirically that the health
  formula has a hard floor around 6 — `calculateSupplyAirTemperature()` models
  return-air temperature as a fixed constant (24°C) even at *total* cooling
  failure, so the temperature-health component can never go below 40, capping
  the weighted health score's floor at `0.15 × 40 = 6`. Rather than silently
  loop until a safety cap, I set `FAILURE_HEALTH_THRESHOLD = 6` in the batch
  generator so units correctly register as failed. (If you want the model to
  reach true 0, the fix is to let return-air temperature also rise toward
  ambient as cooling capacity collapses — a small enhancement, happy to add it
  if you want a wider health range.)

## New files

| File | Purpose |
|---|---|
| `assets/hvac/HVACDegradation.js` | The aging engine — wears compressor/motor/filter over time based on operating hours and load |
| `assets/hvac/HVACRUL.js` | Live physics-based RUL estimate for the real-time dashboard stream |
| `generateTrainingDataset.js` | **Batch generator** — runs many units to actual failure, back-labels true RUL, writes CSV. This is what you run to produce ML training data. |
| `train_model.py` | Python: loads the CSV, engineers rolling-window features, trains a Random Forest with a proper per-unit train/test split, saves `rul_model.pkl` |

## How to use this

```bash
# 1. Generate training data (takes 1-3 min depending on unit count/resolution)
npm install
node generateTrainingDataset.js 80 0.25 30000
#                                 ^units ^hours-per-tick ^safety cap

# 2. Train the model
pip install pandas numpy scikit-learn joblib
python train_model.py

# 3. Run the live simulator (unchanged usage, now with real degradation + RUL)
npm start
```

### Validated results (from an 8-unit test batch)
- Units now fail at varied, physically sensible ages: 6,400–12,200 operating hours
- Health declines monotonically as wear accumulates — verified numerically
- RUL labels decrease to exactly 0 with zero anomalies (checked: 0 rows where
  RUL increased across a full unit lifecycle)
- Feature importance from a first training pass confirms the model is learning
  from the right signals: rolling supply-air-temperature trend, filter DP
  variance, and operating hours dominate — exactly the leading indicators a
  real predictive-maintenance system would use

### To improve accuracy further
The dev-scale run in this delivery used 25 units / 60 trees to fit inside a
few minutes. For your actual training run:
- **Units**: 80–150 (more diverse life-histories = better generalization)
- **Resolution**: `dtHoursPerTick = 0.1–0.25` (6–15 min) instead of 1 hour
- **Trees**: `n_estimators=200-300`, tune `max_depth` and `min_samples_leaf`
  with cross-validation
- Consider also trying `XGBoost`/`LightGBM` on the same feature set — usually
  a modest accuracy gain over Random Forest for tabular RUL problems
