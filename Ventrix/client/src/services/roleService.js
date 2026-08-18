import api from "./apiClient";

export const roleService = {
  list: () => api.get("/roles"),
  getMyPermissions: () => api.get("/roles/my-permissions"),
  getPermissionMatrix: () => api.get("/roles/permissions/matrix"),
  setPermission: (roleId, permissionKey, enabled) =>
    api.patch(`/roles/${roleId}/permissions`, { permissionKey, enabled }),
  batchSetPermissions: (roleId, permissions) =>
    api.put(`/roles/${roleId}/permissions/batch`, { permissions }),
};
