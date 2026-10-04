import api from "./apiClient";

export const alertService = {
  list: (resolved) => api.get(`/alerts${resolved !== undefined ? `?resolved=${resolved}` : ""}`),
  create: (data) => api.post("/alerts", data),
  acknowledge: (id, data = {}) => api.patch(`/alerts/${id}/acknowledge`, data),
  resolve: (id) => api.patch(`/alerts/${id}/resolve`, {}),
};
