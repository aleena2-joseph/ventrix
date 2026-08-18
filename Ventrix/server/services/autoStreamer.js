const pool = require("../config/db");
const assetModel = require("../models/assetModel");
const telemetryModel = require("../models/telemetryModel");

let timer = null;
let tickCount = 0;
let isRunning = false;

const BASE_UNITS = [
  { code: "HVAC-001", baseTemp: 21.4, basePress: 4.80, baseCurr: 13.7, baseFilterDP: 165, state: "NOMINAL", health: 96 },
  { code: "HVAC-002", baseTemp: 22.1, basePress: 4.85, baseCurr: 14.0, baseFilterDP: 172, state: "NOMINAL", health: 94 },
  { code: "HVAC-003", baseTemp: 20.8, basePress: 4.95, baseCurr: 13.4, baseFilterDP: 158, state: "NOMINAL", health: 98 },
  { code: "HVAC-004", baseTemp: 22.6, basePress: 4.75, baseCurr: 14.3, baseFilterDP: 180, state: "NOMINAL", health: 92 },
  { code: "HVAC-005", baseTemp: 25.8, basePress: 3.90, baseCurr: 17.4, baseFilterDP: 285, state: "WARNING", health: 64 },
];

async function tick() {
  tickCount++;
  try {
    const assets = await assetModel.getAllAssets();
    if (!assets || assets.length === 0) return;

    for (const base of BASE_UNITS) {
      const asset = assets.find((a) => a.asset_code === base.code) || assets[0];
      if (!asset) continue;

      // Realistic physical jitter
      const tempNoise = (Math.random() - 0.5) * 0.4;
      const pressNoise = (Math.random() - 0.5) * 0.12;
      const currNoise = (Math.random() - 0.5) * 0.6;
      const filterNoise = Math.floor((Math.random() - 0.5) * 10);
      const voltNoise = Math.floor((Math.random() - 0.5) * 4);

      const temperature = Number((base.baseTemp + tempNoise).toFixed(1));
      const pressure = Number((base.basePress + pressNoise).toFixed(2));
      const current = Number((base.baseCurr + currNoise).toFixed(1));
      const filterDP = base.baseFilterDP + filterNoise;
      const voltage = 412 + voltNoise;
      const power = Number(((current * voltage * 1.732 * 0.85) / 1000).toFixed(2));
      const humidity = 56 + Math.floor((Math.random() - 0.5) * 6);
      const vibration = Number((1.2 + (Math.random() * 0.3)).toFixed(2));
      const healthScore = base.health + Math.floor((Math.random() - 0.5) * 2);

      const reading = {
        recordedAt: new Date(),
        temperature,
        pressure,
        vibration: filterDP, // Stored as kPa/Pa
        current,
        voltage,
        humidity,
        power,
        operatingHours: 1250 + tickCount,
        assetState: base.state,
      };

      const rawPayload = {
        assetId: asset.asset_code,
        timestamp: new Date().toISOString(),
        assetState: base.state,
        environment: {
          ambientTemperature: 32.0,
          humidity,
          supplyVoltage: voltage,
          operatingHours: 1250 + tickCount,
        },
        telemetry: {
          supplyAirTemperature: temperature,
          refrigerantPressure: pressure,
          compressorCurrent: current,
          filterDP,
          powerConsumption: power,
          remainingUsefulLife: base.state === "WARNING" ? 180 : 1200,
        },
        health: {
          healthScore,
          healthStatus: base.state,
        },
        events: [],
      };

      await telemetryModel.persistSimulationReading(asset.id, reading, rawPayload);
    }
  } catch (err) {
    // Keep streamer resilient
  }
}

function start(intervalMs = 3000) {
  if (isRunning) return;
  isRunning = true;
  tick();
  timer = setInterval(tick, intervalMs);
  console.log("⚡ Real-time Telemetry Auto-Streamer active (3s interval)");
}

function stop() {
  if (!isRunning) return;
  isRunning = false;
  if (timer) clearInterval(timer);
  timer = null;
  console.log("⏸️ Real-time Telemetry Auto-Streamer paused");
}

function getStatus() {
  return {
    isRunning,
    tickCount,
    intervalSeconds: 3,
  };
}

module.exports = {
  start,
  stop,
  getStatus,
};
