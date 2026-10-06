/**
 * stream_direct.js
 * ---------------------------------------------------------------
 * Direct HTTP Telemetry Streamer for Ventrix Platform.
 * 
 * Streams live physics-informed HVAC sensor readings directly to:
 * POST http://localhost:5000/api/telemetry
 * authenticated via X-Telemetry-Key header.
 * 
 * Runs without requiring Docker or Kafka brokers.
 * Default interval: 3000ms (3 seconds).
 */

require("./config/env");

const EnvironmentModel = require("./environment/EnvironmentModel");
const MonteCarloEngine = require("./montecarlo/MonteCarloEngine");
const HVACAsset = require("./assets/hvac/HVACAsset");

const VENTRIX_API_URL = process.env.VENTRIX_API_URL || "http://localhost:5000/api/telemetry";
const TELEMETRY_INGEST_KEY = process.env.TELEMETRY_INGEST_KEY || "98fd31cec87260989bfd26db16e0316727cc0236f0434e63534bde68793907c0";
const INTERVAL_MS = parseInt(process.env.STREAM_INTERVAL_MS || "3000", 10);

const ASSET_IDS = ["HVAC-001", "HVAC-002", "HVAC-003", "HVAC-004", "HVAC-005"];

class DirectStreamer {
  constructor() {
    this.monteCarlo = new MonteCarloEngine();
    this.environment = new EnvironmentModel();
    this.environment.setEnvironment(this.monteCarlo.generateEnvironment());
    
    this.assets = ASSET_IDS.map((id, index) => {
      // Vary baseline design lifespan slightly per unit
      const designLife = 18000 + (index * 1500);
      return new HVACAsset(id, designLife);
    });

    this.tickCount = 0;
    this.timer = null;
    this.running = false;
  }

  async sendTelemetry(packet) {
    try {
      const res = await fetch(VENTRIX_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Telemetry-Key": TELEMETRY_INGEST_KEY,
        },
        body: JSON.stringify(packet),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        console.warn(`[Streamer] API responded ${res.status} for ${packet.assetId}: ${errorText}`);
        return false;
      }
      return true;
    } catch (err) {
      console.warn(`[Streamer] Connection error sending ${packet.assetId}: ${err.message}`);
      return false;
    }
  }

  async tick() {
    this.tickCount++;
    this.environment.update(1.0); // advance simulated time
    this.environment.evolve();
    const env = this.environment.getEnvironment();

    const timestamp = new Date().toISOString();
    console.log(`\n📡 [Tick #${this.tickCount}] Streaming live telemetry to Ventrix API (${timestamp})`);

    for (const asset of this.assets) {
      const packet = asset.update(env);
      packet.timestamp = timestamp;

      const ok = await this.sendTelemetry(packet);
      const health = packet.health?.healthScore ?? "—";
      const state = packet.assetState || "NOMINAL";
      const icon = ok ? "✅" : "⚠️";

      console.log(`  ${icon} ${packet.assetId} | State: ${state.padEnd(8)} | Health: ${health}% | Temp: ${packet.telemetry?.supplyAirTemperature}°C | Ref: ${packet.telemetry?.refrigerantPressure} bar`);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;

    console.log("=========================================================");
    console.log(" 🚂 Ventrix Direct Telemetry Streamer Started");
    console.log(` Target Endpoint: ${VENTRIX_API_URL}`);
    console.log(` Polling Interval: ${INTERVAL_MS}ms (3 seconds)`);
    console.log(` Monitored Fleet : ${ASSET_IDS.join(", ")}`);
    console.log("=========================================================");

    this.timer = setInterval(async () => {
      try {
        await this.tick();
      } catch (err) {
        console.error("[Streamer] Tick error:", err.message);
      }
    }, INTERVAL_MS);

    // Initial immediate tick
    this.tick();
  }

  stop() {
    if (!this.running) return;
    clearInterval(this.timer);
    this.timer = null;
    this.running = false;
    console.log("\n[Streamer] Stopped.");
  }
}

const streamer = new DirectStreamer();
streamer.start();

process.on("SIGINT", () => {
  streamer.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  streamer.stop();
  process.exit(0);
});
