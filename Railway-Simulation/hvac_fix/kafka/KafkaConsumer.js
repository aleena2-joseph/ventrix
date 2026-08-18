// KafkaConsumer.js
// -----------------------------------------------------------------------
// Bridges the gap between the simulator (which only publishes to Kafka)
// and Ventrix (which only accepts telemetry over HTTP POST). This is a
// temporary piece — later it can be replaced by a proper Flink job that
// reads from Kafka and writes to Postgres directly — but for now it lets
// the whole pipeline run end-to-end without touching either side's
// existing code.
//
//   Kafka topic "simulation.telemetry"
//        -> parse JSON
//        -> POST http://localhost:5000/api/telemetry
//
// Usage:
//   node kafka/KafkaConsumer.js
//
// Requires Kafka to already be running (see kafka/docker-compose.yml)
// and the Ventrix server to already be running on VENTRIX_API_URL.
// -----------------------------------------------------------------------

require("../config/env");
const { Kafka } = require("kafkajs");

const KAFKA_BROKER = process.env.KAFKA_BROKER || "localhost:9092";
const VENTRIX_API_URL =
  process.env.VENTRIX_API_URL || "http://localhost:5000/api/telemetry";
const TELEMETRY_INGEST_KEY = process.env.TELEMETRY_INGEST_KEY;
const TOPIC = "simulation.telemetry";
const GROUP_ID = "ventrix-bridge-consumer";

const kafka = new Kafka({
  clientId: "ventrix-bridge",
  brokers: [KAFKA_BROKER],
});

const consumer = kafka.consumer({ groupId: GROUP_ID });

// Node 18+ ships a global fetch, which is all we need for a simple POST.
// If you're on an older Node version, `npm install node-fetch` and
// uncomment the line below.
// const fetch = require("node-fetch");

async function forwardToVentrix(payload) {
  const res = await fetch(VENTRIX_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telemetry-Key": TELEMETRY_INGEST_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ventrix API responded ${res.status}: ${text}`);
  }

  return res.json();
}

async function run() {
  if (!TELEMETRY_INGEST_KEY) {
    throw new Error("TELEMETRY_INGEST_KEY must be configured before starting the bridge");
  }
  await consumer.connect();
  console.log("✅ Kafka Consumer Connected");

  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });
  console.log(`👂 Subscribed to "${TOPIC}", forwarding to ${VENTRIX_API_URL}`);

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      let payload;
      try {
        payload = JSON.parse(message.value.toString());
      } catch (err) {
        console.error("❌ Failed to parse Kafka message as JSON:", err.message);
        return;
      }

      try {
        await forwardToVentrix(payload);
        console.log(
          `➡️  Forwarded tick for ${payload.assetId || "unknown asset"} ` +
            `(state: ${payload.assetState || "n/a"})`
        );
      } catch (err) {
        console.error("❌ Failed to forward telemetry to Ventrix:", err.message);
      }
    },
  });
}

run().catch((err) => {
  console.error("❌ Kafka Consumer crashed:", err);
  process.exit(1);
});

process.on("SIGINT", async () => {
  console.log("\nStopping Kafka consumer...");
  await consumer.disconnect();
  process.exit(0);
});
