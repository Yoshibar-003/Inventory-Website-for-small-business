import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";

/** localStorage that never throws (private windows, embedded previews, blocked storage). */
export const safeStore = {
  get(key, fallback) {
    try {
      const v = window.localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* ignore — a remembered preference is never worth an exception */
    }
  },
};

const EMPTY = {
  products: [], categories: [], shop_stock: {}, factory_stock: {},
  orders: [], order_items: [], staff: [], stock_requests: [], stock_removal_batches: [],
  factory_stock_requests: [], factory_stock_request_items: [],
  stock_visibility: { shop: {}, factory: {} },
};

export const OPEN_STATUSES = ["Pending", "Adjusted", "Dispatched"];

/**
 * Owns the entire application state.
 *
 * Every mutation follows the same path:
 *   component -> action() -> api -> server validates & writes -> full snapshot -> setState
 * There is no local stock arithmetic anywhere in the UI, so the sheet and the screen
 * can never disagree about a quantity.
 */
export function useInventory(enabled = true) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // name of the action in flight
  const [error, setError] = useState(null); // { code, vars }
  const [toasts, setToasts] = useState([]);
  const toastSeq = useRef(0);

  const pushToast = useCallback((message, tone = "success") => {
    const id = ++toastSeq.current;
    setToasts((list) => [...list, { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const run = useCallback(async (name, fn) => {
    setBusy(name);
    setError(null);
    try {
      const snapshot = await fn();
      setData(snapshot);
      return snapshot;
    } catch (e) {
      setError({ code: e.code || "err.title", vars: e.vars || {} });
      throw e;
    } finally {
      setBusy(null);
    }
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.bootstrap());
      setError(null);
    } catch (e) {
      setError({ code: e.code || "err.network", vars: e.vars || {} });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) reload();
    else setLoading(false);
  }, [enabled, reload]);

  const actions = useMemo(
    () => ({
      exportMonthlyStockCsv: (p) => api.exportMonthlyStockCsv(p),
      addProduct: (p) => run("addProduct", () => api.addProduct(p)),
      addCategory: (p) => run("addCategory", () => api.addCategory(p)),
      renameCategory: (p) => run("renameCategory:" + p.old_name, () => api.renameCategory(p)),
      deleteCategory: (p) => run("deleteCategory:" + p.name, () => api.deleteCategory(p)),
      setProductCategory: (p) => run("setProductCategory:" + p.product_id, () => api.setProductCategory(p)),
      editProduct: (p) => run("editProduct:" + p.product_id, () => api.editProduct(p)),
      archiveProduct: (p) => run("archiveProduct", () => api.archiveProduct(p)),
      setProductLocationActive: (p) => run("setProductLocationActive:" + p.location + ":" + p.product_id, () => api.setProductLocationActive(p)),
      setStock: (p) => run("setStock:" + p.location + ":" + p.product_id, () => api.setStock(p)),
      setStockBatch: (p) => run("setStockBatch", () => api.setStockBatch(p)),
      createStockAdditionOrder: (p) => run("createStockAdditionOrder", () => api.createStockAdditionOrder(p)),
      requestDailyStockReport: (p) => run("requestDailyStockReport", () => api.requestDailyStockReport(p)),
      decideDailyStockReport: (p) => run("decideDailyStockReport:" + p.batch_id, () => api.decideDailyStockReport(p)),
      createFactoryStockReport: (p) => run("createFactoryStockReport", () => api.createFactoryStockReport(p)),
      decideFactoryStockReport: (p) => run("decideFactoryStockReport:" + p.report_id, () => api.decideFactoryStockReport(p)),
      requestStockRemoval: (p) => run("requestStockRemoval", () => api.requestStockRemoval(p)),
      decideStockRemoval: (p) => run("decideStockRemoval:" + p.stock_request_id, () => api.decideStockRemoval(p)),
      createOrder: (p) => run("createOrder", () => api.createOrder(p)),
      saveApproval: (p) => run("saveApproval", () => api.saveApproval(p)),
      dispatchOrder: (p) => run("dispatchOrder", () => api.dispatchOrder(p)),
      receiveOrder: (p) => run("receiveOrder", () => api.receiveOrder(p)),
      cancelOrder: (p) => run("cancelOrder", () => api.cancelOrder(p)),
      denyOrder: (p) => run("denyOrder", () => api.denyOrder(p)),
    }),
    [run]
  );

  return {
    data, loading, busy, error, toasts,
    setError, pushToast, dismissToast, reload, actions,
  };
}

// ---- Derived views ------------------------------------------------------
// Pure selectors, kept out of components so the same rule is never written twice.

export function stockOf(data, location, productId) {
  const book = location === "factory" ? data.factory_stock : data.shop_stock;
  return Number(book[productId] || 0);
}

export function categoriesOf(data) {
  const stored = (data.categories || []).map((row) => typeof row === "string" ? row : row.name).filter(Boolean);
  return stored.length ? stored : [...new Set((data.products || []).map((product) => product.category || "Other"))].sort();
}

export function productVisible(data, location, productId) {
  const value = data.stock_visibility?.[location]?.[productId];
  return value !== false;
}
export function itemsOf(data, orderId) {
  return data.order_items.filter((i) => i.order_id === orderId);
}

export function productMap(data) {
  const map = {};
  data.products.forEach((p) => (map[p.product_id] = p));
  return map;
}

/** Products at or under their reorder point, most urgent first. */
export function lowStock(data, location = "shop") {
  return data.products
    .filter((p) => p.active !== false && productVisible(data, location, p.product_id))
    .map((p) => {
      const qty = stockOf(data, location, p.product_id);
      const target = Math.max(p.par_level || 0, p.reorder_point || 0);
      return { product: p, qty, deficit: Math.max(0, target - qty) };
    })
    .filter((row) => row.qty <= (row.product.reorder_point || 0))
    .sort((a, b) => a.qty - b.qty || b.deficit - a.deficit);
}

export function ordersByStatus(data, statuses) {
  const list = data.orders.filter((o) => statuses.includes(o.status));
  return list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function orderTotals(data, orderId) {
  const items = itemsOf(data, orderId);
  return {
    lines: items.length,
    requested: items.reduce((s, i) => s + Number(i.requested_qty || 0), 0),
    approved: items.reduce((s, i) => s + Number(i.approved_qty || 0), 0),
    trimmed: items.filter((i) => Number(i.approved_qty) < Number(i.requested_qty)).length,
  };
}

/** Lines the factory cannot currently cover — drives the dispatch guard and its warnings. */
export function shortfalls(data, orderId) {
  return itemsOf(data, orderId)
    .map((item) => {
      const have = stockOf(data, "factory", item.product_id);
      return { ...item, have, short: Math.max(0, Number(item.approved_qty || 0) - have) };
    })
    .filter((row) => row.short > 0);
}
