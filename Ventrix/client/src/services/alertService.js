import api from "./apiClient";

export const alertService = {
  list: (resolved) => api.get(`/alerts${resolved !== undefined ? `?resolved=${resolved}` : ""}`),
  create: (data) => api.post("/alerts", data),
  resolve: (id) => api.patch(`/alerts/${id}/resolve`, {}),
};
