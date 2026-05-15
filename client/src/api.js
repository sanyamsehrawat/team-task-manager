const API_BASE = import.meta.env.VITE_API_URL || "/api";

export function getToken() {
  return localStorage.getItem("team_task_token");
}

export function setToken(token) {
  localStorage.setItem("team_task_token", token);
}

export function clearToken() {
  localStorage.removeItem("team_task_token");
}

export async function api(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}
