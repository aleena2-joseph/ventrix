const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle(res) {
  let body;
  try {
    body = await res.json();
  } catch {
    body = { success: false, message: `Unexpected response (${res.status})` };
  }
  if (res.status === 401) {
    // Don't auto-redirect for auth endpoints — let the login page handle its own errors
    const isAuthEndpoint = res.url && (res.url.includes("/auth/login") || res.url.includes("/auth/register"));
    if (!isAuthEndpoint) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login" && window.location.pathname !== "/") {
        window.location.href = "/login";
      }
    }
  }
  return body;
}

export const api = {
  get: (path) =>
    fetch(`${BASE_URL}${path}`, { headers: { ...authHeaders() } }).then(handle),

  post: (path, data) =>
    fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    }).then(handle),

  put: (path, data) =>
    fetch(`${BASE_URL}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    }).then(handle),

  patch: (path, data) =>
    fetch(`${BASE_URL}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data),
    }).then(handle),

  delete: (path) =>
    fetch(`${BASE_URL}${path}`, { method: "DELETE", headers: { ...authHeaders() } }).then(handle),
};

export default api;
