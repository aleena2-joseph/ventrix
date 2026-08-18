const crypto = require("crypto");

// Machine-to-machine authentication for the Kafka bridge. The bridge is a
// service, so it must not use a browser user's JWT.
const requireTelemetryIngestKey = (req, res, next) => {
  const configuredKey = process.env.TELEMETRY_INGEST_KEY;
  const suppliedKey = req.get("X-Telemetry-Key");

  if (!configuredKey) {
    return res.status(503).json({ success: false, message: "Telemetry ingestion is not configured" });
  }
  if (!suppliedKey) {
    return res.status(401).json({ success: false, message: "Missing telemetry service key" });
  }

  const expected = Buffer.from(configuredKey);
  const actual = Buffer.from(suppliedKey);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return res.status(401).json({ success: false, message: "Invalid telemetry service key" });
  }
  next();
};

module.exports = { requireTelemetryIngestKey };
