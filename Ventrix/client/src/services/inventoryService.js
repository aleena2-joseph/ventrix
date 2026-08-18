import api from "./apiClient";

export const inventoryService = {
  listCategories: () => api.get("/inventory/categories"),
  createCategory: (data) => api.post("/inventory/categories", data),

  listParts: () => api.get("/inventory/parts"),
  list: () => api.get("/inventory/parts"),
  getPart: (id) => api.get(`/inventory/parts/${id}`),
  createPart: (data) => api.post("/inventory/parts", data),
  updatePart: (id, data) => api.put(`/inventory/parts/${id}`, data),

  getStockForPart: (partId) => api.get(`/inventory/stock/${partId}`),
  adjustStock: (data) => api.post("/inventory/stock/adjust", data),

  getTransactionsForPart: (partId) => api.get(`/inventory/transactions/${partId}`),
};
