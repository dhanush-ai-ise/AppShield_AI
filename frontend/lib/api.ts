/**
 * Thin API client for the FastAPI backend.
 * Set NEXT_PUBLIC_API_URL in .env.local (defaults to localhost:8000).
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_TOKEN_KEY = "appshield_admin_token";

function getAdminToken() {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem(ADMIN_TOKEN_KEY) ||
    window.sessionStorage.getItem(ADMIN_TOKEN_KEY)
  );
}

function getAdminUsername() {
  const token = getAdminToken();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadBase64 + "=".repeat((4 - (payloadBase64.length % 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json);
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

function setAdminToken(token: string, remember: boolean) {
  if (typeof window === "undefined") return;
  if (remember) {
    window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
    window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    return;
  }
  window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}

function clearAdminToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

function withAuth(headers: HeadersInit = {}) {
  const token = getAdminToken();
  if (!token) return headers;
  return { ...headers, Authorization: `Bearer ${token}` };
}

async function handle(res: Response) {
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) clearAdminToken();
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

function request(path: string, init: RequestInit = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(`${API_BASE}${path}`, {
    ...init,
    signal: init.signal || controller.signal,
    headers: withAuth(init.headers),
  })
    .then(handle)
    .catch((err) => {
      if (err.name === "AbortError") {
        throw new Error("Request timed out. The server took too long to respond.");
      }
      throw err;
    })
    .finally(() => clearTimeout(timer));
}

export const api = {
  health: () => request("/api/health"),

  loginAdmin: async (username: string, password: string, remember = true) => {
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);
    const result = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    }).then(handle);
    if (result?.access_token) setAdminToken(result.access_token, remember);
    return result;
  },

  logoutAdmin: () => clearAdminToken(),
  isAdminAuthenticated: () => Boolean(getAdminToken()),
  adminUsername: () => getAdminUsername(),

  scanPlayUrl: (url: string, modelName?: string) => {
    const form = new FormData();
    form.append("url", url);
    if (modelName) form.append("model_name", modelName);
    return request("/api/scan/play-url", { method: "POST", body: form });
  },

  scanPackageName: (packageName: string, modelName?: string) => {
    const form = new FormData();
    form.append("package_name", packageName);
    if (modelName) form.append("model_name", modelName);
    return request("/api/scan/package-name", { method: "POST", body: form });
  },

  scanApkUrl: (url: string, modelName?: string) => {
    const form = new FormData();
    form.append("url", url);
    if (modelName) form.append("model_name", modelName);
    return request("/api/scan/apk-url", { method: "POST", body: form });
  },

  scanApkUpload: (file: File, modelName?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (modelName) form.append("model_name", modelName);
    return request("/api/scan/apk-upload", { method: "POST", body: form });
  },

  scanByHash: (sha256: string) => {
    const form = new FormData();
    form.append("sha256", sha256);
    return request("/api/scan/hash", { method: "POST", body: form });
  },

  scanHistory: (limit = 20) => request(`/api/scan/history?limit=${limit}`),

  getBenchmark: () => request("/api/models/benchmark"),

  trainModels: () => request("/api/models/train", { method: "POST" }),

  trainingStatus: () => request("/api/models/train/status"),

  availableModels: () => request("/api/models/available"),

  listDatasets: () => request("/api/datasets/list"),

  uploadDataset: (module: string, file: File, sourceName = "manual_upload") => {
    const form = new FormData();
    form.append("module", module);
    form.append("source_name", sourceName);
    form.append("file", file);
    return request("/api/datasets/upload", { method: "POST", body: form });
  },

  deleteDataset: (module: string, filename: string) =>
    request(`/api/datasets/${module}/${filename}`, { method: "DELETE" }),

  downloadPdfReport: (scanId: string) => `${API_BASE}/api/reports/${scanId}/pdf`,
};
