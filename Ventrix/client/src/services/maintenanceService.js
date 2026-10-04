import api from "./apiClient";

export const maintenanceService = {
  listSchedules: () => api.get("/maintenance/schedules"),
  createSchedule: (data) => api.post("/maintenance/schedules", data),
  updateSchedule: (id, data) => api.patch(`/maintenance/schedules/${id}`, data),
  getAssetSummaries: () => api.get("/maintenance/assets-summary"),
  getAssetHistory: (assetCode) => api.get(`/maintenance/assets/${assetCode}/history`),

  listWorkOrders: () => api.get("/maintenance/work-orders"),
  createWorkOrder: (data) => api.post("/maintenance/work-orders", data),
  updateWorkOrderStatus: (id, status) => api.patch(`/maintenance/work-orders/${id}/status`, { status }),
  acceptWorkOrder: (id) => api.patch(`/maintenance/work-orders/${id}/accept`),
  submitCompletionReport: (id, data) => api.post(`/maintenance/work-orders/${id}/completion-report`, data),
  verifyAndCloseWorkOrder: (id, data) => api.post(`/maintenance/work-orders/${id}/verify-and-close`, data),
  addFindingToWorkOrder: (id, data) => api.post(`/maintenance/work-orders/${id}/findings`, data),
  checkTechnicianAvailability: (technicianId) => api.get(`/maintenance/technicians/${technicianId}/availability`),
  addPartToWorkOrder: (id, data) => api.post(`/maintenance/work-orders/${id}/parts`, data),
  usePart: (id, data) => api.post(`/maintenance/work-orders/${id}/parts`, data),
  getWorkOrderParts: (id) => api.get(`/maintenance/work-orders/${id}/parts`),
};
