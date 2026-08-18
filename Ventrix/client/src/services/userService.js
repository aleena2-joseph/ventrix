import api from "./apiClient";

export const userService = {
  list: (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== "" && v !== "ALL")
    );
    const query = new URLSearchParams(cleanParams).toString();
    return api.get(`/users${query ? `?${query}` : ""}`);
  },
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post("/users", data),
  update: (id, data) => api.put(`/users/${id}`, data),
  updateStatus: (id, status) => api.patch(`/users/${id}/status`, { status }),
  resetPassword: (id, password) => api.patch(`/users/${id}/reset-password`, { password }),
  remove: (id) => api.delete(`/users/${id}`),
};
