// Central API client for the StockSense backend.
// Backend base URL comes from NEXT_PUBLIC_API_URL (defaults to local backend).
// Token is stored in localStorage as `stocksense_token` after login/signup.

const BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("stocksense_token");
}

export function setToken(t) {
  if (typeof window === "undefined") return;
  if (t) localStorage.setItem("stocksense_token", t);
  else localStorage.removeItem("stocksense_token");
}

export function getApiBase() {
  return BASE;
}

async function req(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.code = data?.error?.code || null;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // ── Auth (no token needed except logout) ──
  signup: (payload) => req("/api/auth/signup", { method: "POST", body: payload, auth: false }),
  login: (payload) => req("/api/auth/login", { method: "POST", body: payload, auth: false }),
  logout: () => req("/api/auth/logout", { method: "POST" }),
  forgotPassword: (payload) => req("/api/auth/forgot-password", { method: "POST", body: payload, auth: false }),
  verifyOtp: (payload) => req("/api/auth/verify-otp", { method: "POST", body: payload, auth: false }),
  resetPassword: (payload) => req("/api/auth/reset-password", { method: "POST", body: payload, auth: false }),

  // ── Profile ──
  me: () => req("/api/users/me"),

  // ── Dashboard / operations feed ──
  dashboard: (warehouse) =>
    req(`/api/dashboard/summary${warehouse ? `?warehouse=${warehouse}` : ""}`),
  dashboardByWarehouse: () => req("/api/dashboard/summary/by-warehouse"),
  operations: (qs = "") => req(`/api/operations${qs}`),

  // ── Receipts (incoming, WH/IN) ──
  receipts: (qs = "") => req(`/api/receipts${qs}`),
  receipt: (id) => req(`/api/receipts/${id}`),
  createReceipt: (payload) => req("/api/receipts", { method: "POST", body: payload }),
  validateReceipt: (id) => req(`/api/receipts/${id}/validate`, { method: "POST" }),
  cancelReceipt: (id) => req(`/api/receipts/${id}/cancel`, { method: "POST" }),

  // ── Delivery orders (outgoing, WH/OUT) ──
  deliveries: (qs = "") => req(`/api/delivery-orders${qs}`),
  delivery: (id) => req(`/api/delivery-orders/${id}`),
  createDelivery: (payload) => req("/api/delivery-orders", { method: "POST", body: payload }),
  validateDelivery: (id) => req(`/api/delivery-orders/${id}/validate`, { method: "POST" }),
  cancelDelivery: (id) => req(`/api/delivery-orders/${id}/cancel`, { method: "POST" }),

  // ── Stock / products ──
  products: (qs = "") => req(`/api/products${qs}`),
  product: (id) => req(`/api/products/${id}`),

  // ── Move history (stock ledger) ──
  ledger: (qs = "") => req(`/api/stock-ledger${qs}`),

  // ── Masters ──
  warehouses: () => req("/api/warehouses"),
  createWarehouse: (payload) => req("/api/warehouses", { method: "POST", body: payload }),
  locations: (qs = "") => req(`/api/locations${qs}`),
  createLocation: (payload) => req("/api/locations", { method: "POST", body: payload }),
  suppliers: () => req("/api/suppliers"),
  createSupplier: (payload) => req("/api/suppliers", { method: "POST", body: payload }),
  categories: () => req("/api/categories"),
  createCategory: (payload) => req("/api/categories", { method: "POST", body: payload }),

  // ── Adjustments (stock correction) ──
  adjustments: (qs = "") => req(`/api/adjustments${qs}`),
  createAdjustment: (payload) => req("/api/adjustments", { method: "POST", body: payload }),
  validateAdjustment: (id) => req(`/api/adjustments/${id}/validate`, { method: "POST" }),
};
