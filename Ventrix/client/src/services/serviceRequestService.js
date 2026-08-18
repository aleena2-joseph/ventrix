import api from "./apiClient";

export const serviceRequestService = {
  list: () => api.get("/service-requests"),
  create: (data) => api.post("/service-requests", data),
  updateStatus: (id, status, workOrderId) =>
    api.patch(`/service-requests/${id}/status`, { status, work_order_id: workOrderId }),
};
