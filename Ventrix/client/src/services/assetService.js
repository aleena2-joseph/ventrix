import api from "./apiClient";

// All HVAC assets — used by the Assets page and the dashboard stat cards.
// Auto-scoped to the caller's own organization for customer roles
// (enforced server-side).
export const getAssets = () => api.get("/assets");

// One asset's full record — used by the Asset Details drawer.
export const getAsset = (assetCode) => api.get(`/assets/${assetCode}`);

export const createAsset = (fields) => api.post("/assets", fields);

export const updateAsset = (assetCode, fields) => api.put(`/assets/${assetCode}`, fields);

export const updateAssetStatus = (assetCode, status) =>
  api.patch(`/assets/${assetCode}/status`, { status });
