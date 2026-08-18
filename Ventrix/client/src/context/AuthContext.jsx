import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { login as loginApi, register as registerApi, getMe } from "../services/authService";

const ROLES = ["ADMIN", "ENGINEER", "TECHNICIAN"];
const VENTRIX_ROLES = ["ADMIN", "VENTRIX_ADMIN", "ENGINEER", "TECHNICIAN"];
const CUSTOMER_ROLES = [];

// Default baseline permissions per role (safety fallback if DB is refreshing or offline)
const DEFAULT_ROLE_PERMISSIONS = {
  ADMIN: ["*"],
  VENTRIX_ADMIN: ["*"],
  SUPER_ADMIN: ["*"],
  ENGINEER: [
    "dashboard.view",
    "assets.view",
    "fleet.view",
    "telemetry.view",
    "predictions.view",
    "alerts.view",
    "maintenance.view",
    "maintenance.manage",
    "service_requests.view",
    "service_requests.create",
    "inventory.view",
    "inventory.manage",
    "products.manage",
    "reports.view",
  ],
  TECHNICIAN: [
    "dashboard.view",
    "assets.view",
    "telemetry.view",
    "predictions.view",
    "alerts.view",
    "maintenance.view",
    "maintenance.manage",
    "service_requests.view",
    "service_requests.create",
    "inventory.view",
    "inventory.manage",
    "products.manage",
    "reports.view",
  ],
};

const AuthContext = createContext(null);

function loadStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadStoredUser);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await getMe();
      if (res?.success && res?.data) {
        localStorage.setItem("user", JSON.stringify(res.data));
        setUser(res.data);
      }
    } catch {
      // Ignore background refresh failure
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await loginApi({ email, password });
      if (!res.success) {
        setError(res.message || "Login failed");
        return false;
      }
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));
      setUser(res.user);
      return true;
    } catch {
      setError("Could not reach the backend. Is the server running?");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (fields) => {
    setLoading(true);
    setError(null);
    try {
      const res = await registerApi(fields);
      if (!res.user) {
        setError(res.message || "Registration failed");
        return false;
      }
      return true;
    } catch {
      setError("Could not reach the backend. Is the server running?");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  const role = user?.role_name || user?.role || "ADMIN";
  const userPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const isVentrixRole = true;
  const isCustomerRole = false;

  // Dynamic permission checker with baseline role fallback
  const can = useCallback(
    (permissionKey) => {
      if (!permissionKey) return true;
      if (role === "ADMIN" || role === "SUPER_ADMIN" || role === "VENTRIX_ADMIN") return true;

      // Check DB dynamic permissions if present
      if (userPermissions.length > 0) {
        return userPermissions.includes(permissionKey);
      }

      // Fallback to role standard defaults
      const defaults = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.ADMIN;
      return defaults.includes("*") || defaults.includes(permissionKey);
    },
    [role, userPermissions]
  );

  const value = {
    user,
    role,
    permissions: userPermissions,
    isVentrixRole,
    isCustomerRole,
    can,
    login,
    register,
    logout,
    refreshUser,
    error,
    loading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export { ROLES, VENTRIX_ROLES, CUSTOMER_ROLES, DEFAULT_ROLE_PERMISSIONS };
