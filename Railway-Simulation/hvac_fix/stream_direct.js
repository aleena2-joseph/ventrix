require("./config/env");
const http = require("http");

const API_URL = process.env.VENTRIX_API_URL || "http://localhost:5000/api/telemetry";
const INGEST_KEY = process.env.TELEMETRY_INGEST_KEY || "98fd31cec87260989bfd26db16e0316727cc0236f0434e63534bde68793907c0";

const ASSETS = [
  { id: "HVAC-001", state: "NOMINAL", baseTemp: 21.5, basePress: 4.8, baseCurr: 13.8 },
  { id: "HVAC-002", state: "NOMINAL", baseTemp: 22.0, basePress: 4.9, baseCurr: 14.1 },
  { id: "HVAC-003", state: "NOMINAL", baseTemp: 20.8, basePress: 5.0, baseCurr: 13.5 },
  { id: "HVAC-004", state: "NOMINAL", baseTemp: 22.4, basePress: 4.7, baseCurr: 14.4 },
  { id: "HVAC-005", state: "WARNING", baseTemp: 25.8, basePress: 3.9, baseCurr: 17.2 },
];

let tick = 0;

function generateTelemetry(asset) {
  // Add realistic small fluctuations
  const noise = (Math.random() - 0.5) * 0.4;
  const temp = Number((asset.baseTemp + noise).toFixed(1));
  const press = Number((asset.basePress + (Math.random() - 0.5) * 0.15).toFixed(2));
  const curr = Number((asset.baseCurr + (Math.random() - 0.5) * 0.5).toFixed(1));
  const filterDP = asset.state === "WARNING" ? 285 + Math.floor(Math.random() * 20) : 160 + Math.floor(Math.random() * 20);
  const healthScore = asset.state === "WARNING" ? 64 : 94 + Math.floor(Math.random() * 5);

  return {
    assetId: asset.id,
    timestamp: new Date().toISOString(),
    assetState: asset.state,
    environment: {
      ambientTemperature: 32.5,
      humidity: 58,
      supplyVoltage: 412,
      operatingHours: 1250 + tick,
    },
    telemetry: {
      supplyAirTemperature: temp,
      refrigerantPressure: press,
      compressorCurrent: curr,
      filterDP: filterDP,
      powerConsumption: Number(((curr * 415 * 1.732 * 0.85) / 1000).toFixed(2)),
      remainingUsefulLife: asset.state === "WARNING" ? 180 : 1200,
    },
    health: {
      healthScore: healthScore,
      healthStatus: asset.state,
    },
    events: [],
  };
}

async function sendTelemetry(payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);
    const url = new URL(API_URL);

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 5000,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          "X-Telemetry-Key": INGEST_KEY,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          resolve({ status: res.statusCode, body });
        });
      }
    );

    req.on("error", (err) => {
      resolve({ status: 0, error: err.message });
    });

    req.write(data);
    req.end();
  });
}

async function runTick() {
  tick++;
  console.clear();
  console.log("=========================================================");
  console.log(` 🚂 Ventrix Live Telemetry Streamer — Tick #${tick}`);
  console.log(` Target API: ${API_URL}`);
  console.log("=========================================================");

  for (const asset of ASSETS) {
    const packet = generateTelemetry(asset);
    const res = await sendTelemetry(packet);

    const statusBadge = res.status === 200 || res.status === 201 ? "✅ [SENT 200 OK]" : `❌ [HTTP ${res.status}]`;
    console.log(
      `${statusBadge} ${asset.id} | Temp: ${packet.telemetry.supplyAirTemperature}°C | Press: ${packet.telemetry.refrigerantPressure} bar | Current: ${packet.telemetry.compressorCurrent} A | Health: ${packet.health.healthScore}%`
    );
  }

  console.log("\n📡 Streaming sensor pulses every 3 seconds... (Press Ctrl+C to stop)");
}

console.log("Starting Live Telemetry Streamer...");
runTick();
setInterval(runTick, 3000);
