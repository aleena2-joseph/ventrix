import api from "./apiClient";

export const maintenanceService = {
  listSchedules: () => api.get("/maintenance/schedules"),
  createSchedule: (data) => api.post("/maintenance/schedules", data),

  listWorkOrders: () => api.get("/maintenance/work-orders"),
  createWorkOrder: (data) => api.post("/maintenance/work-orders", data),
  updateWorkOrderStatus: (id, status) => api.patch(`/maintenance/work-orders/${id}/status`, { status }),
  addPartToWorkOrder: (id, data) => api.post(`/maintenance/work-orders/${id}/parts`, data),
  usePart: (id, data) => api.post(`/maintenance/work-orders/${id}/parts`, data),
  getWorkOrderParts: (id) => api.get(`/maintenance/work-orders/${id}/parts`),
};
