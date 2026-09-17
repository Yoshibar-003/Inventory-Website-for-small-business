/**
 * The one place the UI talks to a backend.
 *
 * Requests are sent to the Netlify Supabase API and return a full snapshot
 *   { products, shop_stock, factory_stock, orders, order_items, staff, server_time }
 * Returning the whole snapshot after every mutation keeps the client dumb: the server
 * owns the arithmetic, the client only re-renders. The dataset for one shop is a few
 * hundred rows, so this stays cheap; see README for the delta strategy if you outgrow it.
 */
const USE_LOCAL_MOCK = true;

class ApiError extends Error {
  constructor(code, vars = {}) {
    super(code);
    this.code = code;
    this.vars = vars;
  }
}

export const CONFIG = {
  ENDPOINT: "/.netlify/functions/api",
  TIMEOUT_MS: 20000,
};

let authToken = safeToken();
let primedSnapshot = null;

function safeToken() {
  try { return window.localStorage.getItem("scoop.sql.authToken") || ""; } catch (_) { return ""; }
}

export function setAuthToken(token) {
  authToken = token || "";
  try {
    if (authToken) window.localStorage.setItem("scoop.sql.authToken", authToken);
    else window.localStorage.removeItem("scoop.sql.authToken");
  } catch (_) { /* storage is optional */ }
}

export function newRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "req-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

async function call(action, payload = {}) {
  if (USE_LOCAL_MOCK) {
    const { localMockCall } = await import("./localMockApi.js");
    return localMockCall(action, payload);
  }
  const body = JSON.stringify({ action, token: authToken, payload });
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
  let res;
  try {
    res = await fetch(CONFIG.ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      redirect: "follow",
      credentials: "same-origin",
      signal: controller.signal,
    });
  } catch (e) {
    throw new ApiError("err.network");
  } finally {
    window.clearTimeout(timeout);
  }
  if (!res.ok) throw new ApiError("err.network");
  const json = await res.json();
  if (!json.ok) throw new ApiError(json.error && json.error.code ? json.error.code : "err.title", (json.error && json.error.vars) || {});
  if (authToken) setAuthToken("");
  return json.data;
}

export const api = {
  login:        async (p) => {
    const result = await call("login", p);
    primedSnapshot = result.snapshot || null;
    return result;
  },
  logout:       () => call("logout"),
  staffAccounts:()  => call("staffAccounts"),
  saveStaffAccount:(p) => call("saveStaffAccount", p),
  deleteStaffAccount:(p) => call("deleteStaffAccount", { ...p, request_id: newRequestId() }),
  exportMonthlyStockCsv:(p) => call("exportMonthlyStockCsv", p),
  bootstrap:    ()  => {
    if (primedSnapshot) {
      const result = primedSnapshot;
      primedSnapshot = null;
      return Promise.resolve(result);
    }
    return call("bootstrap");
  },
  addProduct:   (p) => call("addProduct", p),
  addCategory:  (p) => call("addCategory", p),
  renameCategory:(p) => call("renameCategory", p),
  deleteCategory:(p) => call("deleteCategory", p),
  setProductCategory:(p) => call("setProductCategory", p),
  editProduct:  (p) => call("editProduct", { ...p, request_id: newRequestId() }),
  archiveProduct:(p) => call("archiveProduct", { ...p, request_id: newRequestId() }),
  setProductLocationActive:(p) => call("setProductLocationActive", { ...p, request_id: newRequestId() }),
  setStock:     (p) => call("setStock", p),
  setStockBatch:(p) => call("setStockBatch", { ...p, request_id: newRequestId() }),
  createStockAdditionOrder:(p) => call("createStockAdditionOrder", { ...p, request_id: newRequestId() }),
  requestDailyStockReport:(p) => call("requestDailyStockReport", { ...p, request_id: newRequestId() }),
  decideDailyStockReport:(p) => call("decideDailyStockReport", { ...p, request_id: newRequestId() }),
  createFactoryStockReport:(p) => call("createFactoryStockReport", { ...p, request_id: newRequestId() }),
  decideFactoryStockReport:(p) => call("decideFactoryStockReport", { ...p, request_id: newRequestId() }),
  requestStockRemoval:(p) => call("requestStockRemoval", { ...p, request_id: newRequestId() }),
  decideStockRemoval:(p) => call("decideStockRemoval", { ...p, request_id: newRequestId() }),
  createOrder:  (p) => call("createOrder", { ...p, request_id: newRequestId() }),
  saveApproval: (p) => call("saveApproval", { ...p, request_id: newRequestId() }),
  dispatchOrder:(p) => call("dispatchOrder", { ...p, request_id: newRequestId() }),
  receiveOrder: (p) => call("receiveOrder", { ...p, request_id: newRequestId() }),
  cancelOrder:  (p) => call("cancelOrder", { ...p, request_id: newRequestId() }),
  denyOrder:    (p) => call("denyOrder", { ...p, request_id: newRequestId() }),
  pushSubscribe:(p) => call("pushSubscribe", p),
  pushUnsubscribe:(p) => call("pushUnsubscribe", p),
};

export { ApiError };
