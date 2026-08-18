import api from "./apiClient";

// Latest reading for every asset — used for the dashboard overview
// and the assets table. Auto-scoped to the caller's organization for
// customer roles.
export const getLatestTelemetry = () => api.get("/telemetry/latest");

// Recent history for one asset (for charts) — asset_code e.g. "HVAC-001"
export const getTelemetryHistory = (assetCode, limit = 50) =>
  api.get(`/telemetry/${assetCode}/history?limit=${limit}`);
