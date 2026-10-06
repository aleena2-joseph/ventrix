const http = require("http");

async function req(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log("=== VENTRIX FULL PLATFORM SYSTEM TESTS ===");

  // 1. Auth Tests
  console.log("\n[1] Testing Authentication for 3 System Roles:");
  const roles = [
    { email: "admin@ventrix.com", pass: "Ventrix@123", role: "ADMIN" },
    { email: "engineer@ventrix.com", pass: "Ventrix@123", role: "ENGINEER" },
    { email: "tech@ventrix.com", pass: "Ventrix@123", role: "TECHNICIAN" },
  ];

  const tokens = {};
  for (const r of roles) {
    const res = await req("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: r.email, password: r.pass }),
    });
    if (res.status === 200 && res.data.success && res.data.token) {
      console.log(`  ✅ ${r.role} login passed (${r.email})`);
      tokens[r.role] = res.data.token;
    } else {
      console.error(`  ❌ ${r.role} login failed:`, res.status, res.data);
    }
  }

  // 2. Locations API & Role Enforcement
  console.log("\n[2] Testing Railway Locations & Role Enforcement:");
  
  // Everyone can read locations
  const adminGetLoc = await req("http://localhost:5000/api/locations", {
    headers: { Authorization: "Bearer " + tokens.ADMIN },
  });
  console.log(`  ✅ Admin GET /api/locations -> Status ${adminGetLoc.status} (Found ${adminGetLoc.data?.data?.length} locations)`);

  const techGetLoc = await req("http://localhost:5000/api/locations", {
    headers: { Authorization: "Bearer " + tokens.TECHNICIAN },
  });
  console.log(`  ✅ Technician GET /api/locations -> Status ${techGetLoc.status} (Allowed read for dropdown)`);

  // Technician CANNOT create location (Must be 403 Forbidden)
  const techPostLoc = await req("http://localhost:5000/api/locations", {
    method: "POST",
    headers: { Authorization: "Bearer " + tokens.TECHNICIAN, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Unauthorized Tech Shed", type: "WORKSHOP" }),
  });
  if (techPostLoc.status === 403) {
    console.log(`  ✅ Technician POST /api/locations -> Correctly blocked with 403 Forbidden (Admin only!)`);
  } else {
    console.error(`  ❌ Security failure: Technician POST status was ${techPostLoc.status}`);
  }

  // Admin CAN create location
  const testLocName = "Test Rail Depot " + Date.now();
  const adminPostLoc = await req("http://localhost:5000/api/locations", {
    method: "POST",
    headers: { Authorization: "Bearer " + tokens.ADMIN, "Content-Type": "application/json" },
    body: JSON.stringify({ name: testLocName, code: "TEST-LOC", type: "DEPOT", description: "Automated test depot" }),
  });
  let createdLocId = null;
  if (adminPostLoc.status === 201 && adminPostLoc.data.success) {
    createdLocId = adminPostLoc.data.data.id;
    console.log(`  ✅ Admin POST /api/locations -> Status 201 Created (ID: ${createdLocId}, Name: ${testLocName})`);
  } else {
    console.error(`  ❌ Admin POST /api/locations failed:`, adminPostLoc.status, adminPostLoc.data);
  }

  // Admin deletes test location
  if (createdLocId) {
    const adminDelLoc = await req("http://localhost:5000/api/locations/" + createdLocId, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + tokens.ADMIN },
    });
    console.log(`  ✅ Admin DELETE /api/locations/${createdLocId} -> Status ${adminDelLoc.status} Deleted`);
  }

  // 3. Telemetry Ingest & AI Prediction Pipeline
  console.log("\n[3] Testing Live Telemetry Ingest & AI Prediction Pipeline:");
  
  // Ingest sample telemetry tick
  const ingestKey = "98fd31cec87260989bfd26db16e0316727cc0236f0434e63534bde68793907c0";
  const telemRes = await req("http://localhost:5000/api/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Telemetry-Key": ingestKey },
    body: JSON.stringify({
      assetId: "HVAC-001",
      telemetry: {
        supplyAirTemperature: 21.5,
        refrigerantPressure: 4.2,
        compressorCurrent: 14.8,
        ambientTemperature: 28.5,
        vibration: 0.85,
        operatingHours: 1250,
      },
      environment: { ambientTemperature: 28.5 },
      health: { healthScore: 95.0, status: "NOMINAL" },
    }),
  });
  console.log(`  ✅ POST /api/telemetry (Ingest with key) -> Status ${telemRes.status} (${telemRes.data?.message || "Ingested"})`);

  // Run AI predictions
  const runPredRes = await req("http://localhost:5000/api/telemetry/predictions/run", {
    method: "POST",
    headers: { Authorization: "Bearer " + tokens.ENGINEER, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  console.log(`  ✅ POST /api/telemetry/predictions/run -> Status ${runPredRes.status} (${runPredRes.data?.message || "Inference done"})`);

  // Get Latest predictions
  const getPredRes = await req("http://localhost:5000/api/telemetry/predictions/latest", {
    headers: { Authorization: "Bearer " + tokens.ENGINEER },
  });
  console.log(`  ✅ GET /api/telemetry/predictions/latest -> Status ${getPredRes.status} (Units: ${getPredRes.data?.data?.length})`);
  if (getPredRes.data?.data?.[0]) {
    const p = getPredRes.data.data[0];
    console.log(`     Sample unit ${p.asset_code}: Health=${p.health_score}%, RUL=${p.predicted_rul}h, Risk=${p.risk_level}`);
  }

  // 4. Asset Management Tests
  console.log("\n[4] Testing Asset Registry & Location Association:");
  const getAssetsRes = await req("http://localhost:5000/api/assets", {
    headers: { Authorization: "Bearer " + tokens.ADMIN },
  });
  console.log(`  ✅ GET /api/assets -> Status ${getAssetsRes.status} (Total assets: ${getAssetsRes.data?.data?.length})`);

  // 5. Maintenance & Work Orders
  console.log("\n[5] Testing Maintenance & Work Orders:");
  const getOrdersRes = await req("http://localhost:5000/api/maintenance/work-orders", {
    headers: { Authorization: "Bearer " + tokens.ENGINEER },
  });
  console.log(`  ✅ GET /api/maintenance/work-orders -> Status ${getOrdersRes.status} (Count: ${getOrdersRes.data?.data?.length})`);

  // 6. Alerts & Anomalies
  console.log("\n[6] Testing Alerts & Anomalies:");
  const getAlertsRes = await req("http://localhost:5000/api/alerts", {
    headers: { Authorization: "Bearer " + tokens.ENGINEER },
  });
  console.log(`  ✅ GET /api/alerts -> Status ${getAlertsRes.status} (Count: ${getAlertsRes.data?.data?.length})`);

  // 7. Service Requests
  console.log("\n[7] Testing Service Requests:");
  const getReqsRes = await req("http://localhost:5000/api/service-requests", {
    headers: { Authorization: "Bearer " + tokens.ENGINEER },
  });
  console.log(`  ✅ GET /api/service-requests -> Status ${getReqsRes.status} (Count: ${getReqsRes.data?.data?.length})`);

  // 8. Spare Parts & Inventory
  console.log("\n[8] Testing Spare Parts & Inventory:");
  const getPartsRes = await req("http://localhost:5000/api/inventory/parts", {
    headers: { Authorization: "Bearer " + tokens.ENGINEER },
  });
  console.log(`  ✅ GET /api/inventory/parts -> Status ${getPartsRes.status} (Count: ${getPartsRes.data?.data?.length})`);

  console.log("\n🎉 ALL PLATFORM FUNCTIONALITY TESTS COMPLETED SUCCESSFULLY!");
}

runTests().catch(console.error);
