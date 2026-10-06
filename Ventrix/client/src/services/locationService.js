import api from "./apiClient";

// Retrieve list of all registered railway depots, coaching yards, and coach zones
export const getLocations = () => api.get("/locations");

// Admin only: create a new railway depot or coach location
export const createLocation = (data) => api.post("/locations", data);

// Admin only: delete a location
export const deleteLocation = (id) => api.delete(`/locations/${id}`);
