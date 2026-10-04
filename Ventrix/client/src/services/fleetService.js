import { api } from "./apiClient";

export const fleetService = {
  getHierarchy: () => api.get("/fleet/hierarchy"),
  getCoachTwin: (coachId) => api.get(`/fleet/coaches/${coachId}/twin`),
};

export default fleetService;
