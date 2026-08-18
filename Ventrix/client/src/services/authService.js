import api from "./apiClient";

export async function login(data) {
  return api.post("/auth/login", data);
}

export async function register(data) {
  return api.post("/auth/register", data);
}

export async function getMe() {
  return api.get("/auth/me");
}