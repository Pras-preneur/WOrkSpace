// Thin REST client with automatic access-token refresh.
const BASE: string = (window as any).__OT_API__ || "/api/v1";
const K = { access: "ot_access", refresh: "ot_refresh" };

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k: string) => { try { localStorage.removeItem(k); } catch {} },
};

export class ApiError extends Error {
  status: number; code: string; details: { field: string; message: string }[] | null;
  constructor(status: number, code: string, message: string, details: any) {
    super(message); this.status = status; this.code = code; this.details = details;
  }
}

export const tokens = {
  set(a: string, r?: string) { store.set(K.access, a); if (r) store.set(K.refresh, r); },
  clear() { store.del(K.access); store.del(K.refresh); },
  has: () => !!store.get(K.access),
};

let onAuthLost: () => void = () => {};
export const setAuthLostHandler = (fn: () => void) => { onAuthLost = fn; };

let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  const rt = store.get(K.refresh);
  if (!rt) return false;
  refreshing ||= fetch(`${BASE}/auth/refresh`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: rt }),
  }).then(async (r) => {
    if (!r.ok) return false;
    const d = await r.json(); tokens.set(d.access_token, d.refresh_token); return true;
  }).catch(() => false).finally(() => { setTimeout(() => (refreshing = null), 0); });
  return refreshing;
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const at = store.get(K.access);
  if (at) headers["Authorization"] = `Bearer ${at}`;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, "network", "Cannot reach the server. Check your connection and try again.", null);
  }
  if (res.status === 401 && retry && !path.startsWith("/auth/login")) {
    if (await tryRefresh()) return request<T>(method, path, body, false);
    tokens.clear(); onAuthLost();
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error || {};
    throw new ApiError(res.status, e.code || "error", e.message || `Request failed (${res.status})`, e.details || null);
  }
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => request<T>("GET", p),
  post: <T = any>(p: string, b?: unknown) => request<T>("POST", p, b ?? {}),
  patch: <T = any>(p: string, b: unknown) => request<T>("PATCH", p, b),
  put: <T = any>(p: string, b: unknown) => request<T>("PUT", p, b),
  del: <T = any>(p: string) => request<T>("DELETE", p),
};

export const qs = (o: Record<string, any>) => {
  const p = Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== false)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v === true ? "1" : String(v))}`);
  return p.length ? `?${p.join("&")}` : "";
};
