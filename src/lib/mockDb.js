/**
 * In-memory mirror of the Google Sheets backend.
 *
 * Every rule enforced here is also enforced in apps-script/Code.gs. Keeping the two
 * in step is deliberate: the UI can be developed and demoed offline, and the server
 * stays the single source of truth in production (never trust the client's arithmetic).
 */

const TODAY = "2026-09-04";
const YESTERDAY = "2026-09-03";

export const CATEGORIES = ["Stick", "Cup", "Cone", "Tub", "Base", "Box 330ml", "Tray", "Box 3L", "Other"];
export const UNITS = ["pcs", "tub", "bag", "box", "tray"];

function seedProducts() {
  return [
    { product_id: "P001", product_name: "Coconut Milk Bar",      product_name_th: "ไอศกรีมกะทิแท่ง",        category: "Stick", unit: "pcs", reorder_point: 24, par_level: 96,  active: true },
    { product_id: "P002", product_name: "Thai Tea Cup",          product_name_th: "ไอศกรีมชาไทยถ้วย",       category: "Cup",   unit: "pcs", reorder_point: 30, par_level: 120, active: true },
    { product_id: "P003", product_name: "Mango Sorbet 4L",       product_name_th: "ซอร์เบต์มะม่วง 4 ลิตร",   category: "Tub",   unit: "tub", reorder_point: 3,  par_level: 12,  active: true },
    { product_id: "P004", product_name: "Durian Cup",            product_name_th: "ไอศกรีมทุเรียนถ้วย",     category: "Cup",   unit: "pcs", reorder_point: 20, par_level: 80,  active: true },
    { product_id: "P005", product_name: "Chocolate Cone",        product_name_th: "โคนช็อกโกแลต",           category: "Cone",  unit: "pcs", reorder_point: 24, par_level: 96,  active: true },
    { product_id: "P006", product_name: "Strawberry Cone",       product_name_th: "โคนสตรอว์เบอร์รี",        category: "Cone",  unit: "pcs", reorder_point: 24, par_level: 96,  active: true },
    { product_id: "P007", product_name: "Black Sesame Cup",      product_name_th: "ไอศกรีมงาดำถ้วย",        category: "Cup",   unit: "pcs", reorder_point: 18, par_level: 72,  active: true },
    { product_id: "P008", product_name: "Young Coconut 4L",      product_name_th: "มะพร้าวอ่อน 4 ลิตร",      category: "Tub",   unit: "tub", reorder_point: 2,  par_level: 10,  active: true },
    { product_id: "P009", product_name: "Matcha Bar",            product_name_th: "ไอศกรีมมัทฉะแท่ง",       category: "Stick", unit: "pcs", reorder_point: 24, par_level: 96,  active: true },
    { product_id: "P010", product_name: "Vanilla Soft-serve 5L", product_name_th: "เบสซอฟต์เสิร์ฟวานิลลา 5 ลิตร", category: "Base", unit: "bag", reorder_point: 4, par_level: 16, active: true },
    { product_id: "P011", product_name: "Chocolate Soft-serve Base", product_name_th: "เบสซอฟต์เสิร์ฟช็อกโกแลต", category: "Base", unit: "bag", reorder_point: 4, par_level: 16, active: true },
    { product_id: "P012", product_name: "Coconut 330ml Box", product_name_th: "กล่องมะพร้าว 330 มล.", category: "Box 330ml", unit: "box", reorder_point: 12, par_level: 48, active: true },
    { product_id: "P013", product_name: "Thai Tea 330ml Box", product_name_th: "กล่องชาไทย 330 มล.", category: "Box 330ml", unit: "box", reorder_point: 12, par_level: 48, active: true },
    { product_id: "P014", product_name: "Assorted Bar Tray", product_name_th: "ถาดไอศกรีมแท่งรวมรส", category: "Tray", unit: "tray", reorder_point: 4, par_level: 16, active: true },
    { product_id: "P015", product_name: "Assorted Cup Tray", product_name_th: "ถาดไอศกรีมถ้วยรวมรส", category: "Tray", unit: "tray", reorder_point: 4, par_level: 16, active: true },
    { product_id: "P016", product_name: "Mango 3L Box", product_name_th: "กล่องมะม่วง 3 ลิตร", category: "Box 3L", unit: "box", reorder_point: 3, par_level: 12, active: true },
    { product_id: "P017", product_name: "Coconut 3L Box", product_name_th: "กล่องมะพร้าว 3 ลิตร", category: "Box 3L", unit: "box", reorder_point: 3, par_level: 12, active: true },
    { product_id: "P018", product_name: "Empty Cone Pack", product_name_th: "แพ็กโคนเปล่า", category: "Other", unit: "bag", reorder_point: 5, par_level: 20, active: true },
    { product_id: "P019", product_name: "Dry Ice Bag", product_name_th: "ถุงน้ำแข็งแห้ง", category: "Other", unit: "bag", reorder_point: 5, par_level: 20, active: true },
  ];
}

function seedState() {
  return {
    products: seedProducts(),
    // Shop is thin on cones and durian — the low-stock path is live on first load.
    shop_stock: {
      P001: 41, P002: 22, P003: 5, P004: 12, P005: 9,
      P006: 16, P007: 33, P008: 3, P009: 58, P010: 6,
    },
    // The factory is short on Strawberry Cone (P006) and Young Coconut (P008):
    // that is what forces the "adjust before dispatch" path in the demo.
    factory_stock: {
      P001: 260, P002: 310, P003: 22, P004: 140, P005: 180,
      P006: 40, P007: 150, P008: 4, P009: 220, P010: 26,
    },
    orders: [
      {
        order_id: "ORD-20260903-01", date: YESTERDAY + "T07:40:00+07:00", status: "Completed",
        created_by: "Bo", note: "",
        dispatched_by: "สมชาย", dispatched_at: YESTERDAY + "T08:55:00+07:00",
        received_by: "Bo", received_at: YESTERDAY + "T10:20:00+07:00",
      },
      {
        order_id: "ORD-20260904-01", date: TODAY + "T06:55:00+07:00", status: "Dispatched",
        created_by: "Bo", note: "ส่งก่อนเที่ยงถ้าได้",
        dispatched_by: "สมชาย", dispatched_at: TODAY + "T08:10:00+07:00",
        received_by: "", received_at: "",
      },
      {
        order_id: "ORD-20260904-02", date: TODAY + "T09:15:00+07:00", status: "Pending",
        created_by: "Nok", note: "",
        dispatched_by: "", dispatched_at: "", received_by: "", received_at: "",
      },
    ],
    stock_requests: [],
    order_items: [
      { order_id: "ORD-20260903-01", product_id: "P001", requested_qty: 60, approved_qty: 60 },
      { order_id: "ORD-20260903-01", product_id: "P002", requested_qty: 90, approved_qty: 72 },
      { order_id: "ORD-20260904-01", product_id: "P005", requested_qty: 84, approved_qty: 84 },
      { order_id: "ORD-20260904-01", product_id: "P009", requested_qty: 40, approved_qty: 40 },
      { order_id: "ORD-20260904-01", product_id: "P003", requested_qty: 6,  approved_qty: 5  },
      { order_id: "ORD-20260904-02", product_id: "P006", requested_qty: 80, approved_qty: 80 },
      { order_id: "ORD-20260904-02", product_id: "P008", requested_qty: 7,  approved_qty: 7  },
      { order_id: "ORD-20260904-02", product_id: "P004", requested_qty: 68, approved_qty: 68 },
    ],
    staff: ["Bo", "Nok", "สมชาย", "ก้อย"],
    _seq: 2,
  };
}

export class ApiError extends Error {
  constructor(code, vars) {
    super(code);
    this.code = code;      // an i18n key, e.g. "err.insufficient"
    this.vars = vars || {}; // interpolation values for that key
    this.name = "ApiError";
  }
}

const clone = (v) => JSON.parse(JSON.stringify(v));

function toInt(value, fallback = 0) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

function pad(n, width) {
  return String(n).padStart(width, "0");
}

/**
 * The mock database. Methods mirror the Apps Script actions one for one and
 * always resolve with a full snapshot, so the client never patches state by hand.
 */
export class MockDb {
  constructor() {
    this.state = seedState();
    this._seen = new Map(); // request_id -> snapshot, for idempotent retries
  }

  reset() {
    this.state = seedState();
    this._seen = new Map();
    return this.snapshot();
  }

  snapshot() {
    return clone({
      products: this.state.products,
      shop_stock: this.state.shop_stock,
      factory_stock: this.state.factory_stock,
      orders: this.state.orders,
      order_items: this.state.order_items,
      stock_requests: this.state.stock_requests,
      staff: this.state.staff,
      server_time: new Date().toISOString(),
    });
  }

  _idempotent(requestId, work) {
    if (requestId && this._seen.has(requestId)) return this._seen.get(requestId);
    const result = work();
    if (requestId) this._seen.set(requestId, result);
    return result;
  }

  _product(productId) {
    const p = this.state.products.find((x) => x.product_id === productId);
    if (!p) throw new ApiError("err.title");
    return p;
  }

  _order(orderId) {
    const o = this.state.orders.find((x) => x.order_id === orderId);
    if (!o) throw new ApiError("err.title");
    return o;
  }

  _itemsOf(orderId) {
    return this.state.order_items.filter((i) => i.order_id === orderId);
  }

  _rememberStaff(name) {
    const clean = String(name || "").trim();
    if (!clean) return;
    this.state.staff = [clean, ...this.state.staff.filter((s) => s !== clean)].slice(0, 8);
  }

  _nextOrderId() {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const todays = this.state.orders.filter((o) => o.order_id.startsWith("ORD-" + stamp)).length;
    return "ORD-" + stamp + "-" + pad(todays + 1, 2);
  }

  // ---- Products & stock -------------------------------------------------

  addProduct(payload) {
    const name = String(payload.product_name || "").trim();
    const nameTh = String(payload.product_name_th || "").trim();
    if (!name && !nameTh) throw new ApiError("product.nameRequired");
    const exists = this.state.products.some(
      (p) =>
        (name && p.product_name.toLowerCase() === name.toLowerCase()) ||
        (nameTh && p.product_name_th === nameTh)
    );
    if (exists) throw new ApiError("product.duplicate");

    const maxNum = this.state.products.reduce((max, p) => {
      const n = toInt(String(p.product_id).replace(/\D/g, ""), 0);
      return n > max ? n : max;
    }, 0);
    const product = {
      product_id: "P" + pad(maxNum + 1, 3),
      product_name: name || nameTh,
      product_name_th: nameTh || name,
      category: CATEGORIES.includes(payload.category) ? payload.category : "Cup",
      unit: UNITS.includes(payload.unit) ? payload.unit : "pcs",
      reorder_point: Math.max(0, toInt(payload.reorder_point, 12)),
      par_level: Math.max(0, toInt(payload.par_level, 48)),
      active: true,
      barcode: String(payload.barcode || "").trim(),
    };
    this.state.products.push(product);
    this.state.shop_stock[product.product_id] = 0;
    this.state.factory_stock[product.product_id] = 0;
    return this.snapshot();
  }

  archiveProduct(payload) {
    const product = this.state.products.find((p) => p.product_id === String(payload.product_id));
    if (!product) throw new ApiError("err.title", { product: String(payload.product_id) });
    product.active = false;
    return this.snapshot();
  }

  /** Renames a product_id (cascading to stock/orders/requests) and/or updates its levels. */
  editProduct(payload) {
    const product = this._product(payload.product_id);
    if (!String(payload.reason || "").trim()) throw new ApiError("product.editReasonRequired");
    const reorderPoint = toInt(payload.reorder_point, -1);
    const parLevel = toInt(payload.par_level, -1);
    if (reorderPoint < 0 || parLevel < 0) throw new ApiError("err.negative");

    const rawNewId = payload.new_product_id !== undefined && payload.new_product_id !== null
      ? String(payload.new_product_id).trim() : "";
    if (rawNewId && rawNewId !== product.product_id) {
      if (this.state.products.some((p) => p.product_id === rawNewId)) throw new ApiError("product.idTaken");
      const oldId = product.product_id;
      product.product_id = rawNewId;
      [this.state.shop_stock, this.state.factory_stock].forEach((book) => {
        if (Object.prototype.hasOwnProperty.call(book, oldId)) {
          book[rawNewId] = book[oldId];
          delete book[oldId];
        }
      });
      this.state.order_items.forEach((item) => { if (item.product_id === oldId) item.product_id = rawNewId; });
      this.state.stock_requests.forEach((item) => { if (item.product_id === oldId) item.product_id = rawNewId; });
    }
    product.reorder_point = reorderPoint;
    product.par_level = parLevel;
    return this.snapshot();
  }

  setStock(payload) {
    const { location, product_id } = payload;
    if (!String(payload.reason || "").trim()) throw new ApiError("stock.adjustReasonRequired");
    const qty = toInt(payload.new_quantity, -1);
    if (qty < 0) throw new ApiError("err.negative");
    this._product(product_id);
    const book = location === "factory" ? this.state.factory_stock : this.state.shop_stock;
    book[product_id] = qty;
    return this.snapshot();
  }

  requestStockRemoval(payload) {
    const location = payload.location === "factory" ? "factory" : "shop";
    const quantity = toInt(payload.quantity, 0);
    this._product(payload.product_id);
    const book = location === "factory" ? this.state.factory_stock : this.state.shop_stock;
    if (quantity <= 0) throw new ApiError("err.negative");
    if (quantity > toInt(book[payload.product_id], 0)) throw new ApiError("err.insufficientStock");
    this.state.stock_requests.push({
      request_id: "SR-" + pad(this.state.stock_requests.length + 1, 3),
      location, product_id: payload.product_id, quantity,
      reason: String(payload.reason || ""), requested_by: String(payload.requested_by || "Employee"),
      requested_at: new Date().toISOString(), status: "Pending", decided_by: "", decided_at: "",
    });
    return this.snapshot();
  }

  decideStockRemoval(payload) {
    return this._idempotent(payload.request_id, () => {
      const request = this.state.stock_requests.find((item) => item.request_id === payload.stock_request_id);
      if (!request || request.status !== "Pending") throw new ApiError("err.badState");
      if (payload.approve) {
        const book = request.location === "factory" ? this.state.factory_stock : this.state.shop_stock;
        if (toInt(book[request.product_id], 0) < request.quantity) throw new ApiError("err.insufficientStock");
        book[request.product_id] -= request.quantity;
      }
      request.status = payload.approve ? "Approved" : "Denied";
      request.decided_by = String(payload.decided_by || "Owner");
      request.decided_at = new Date().toISOString();
      return this.snapshot();
    });
  }
  // ---- Order workflow ---------------------------------------------------

  /** Step 1 — Shop creates the order. */
  createOrder(payload) {
    return this._idempotent(payload.request_id, () => {
      const lines = (payload.items || [])
        .map((i) => ({ product_id: i.product_id, requested_qty: toInt(i.requested_qty, 0) }))
        .filter((i) => i.requested_qty > 0);
      if (!lines.length) throw new ApiError("err.emptyOrder");
      lines.forEach((l) => this._product(l.product_id));

      const orderId = this._nextOrderId();
      const createdBy = String(payload.created_by || "").trim() || "Shop";
      this._rememberStaff(payload.created_by);
      this.state.orders.push({
        order_id: orderId,
        date: new Date().toISOString(),
        status: "Pending",
        created_by: createdBy,
        note: String(payload.note || "").trim(),
        dispatched_by: "", dispatched_at: "", received_by: "", received_at: "",
      });
      lines.forEach((l) => {
        this.state.order_items.push({
          order_id: orderId,
          product_id: l.product_id,
          requested_qty: l.requested_qty,
          approved_qty: l.requested_qty, // factory starts from what the shop asked for
        });
      });
      const snap = this.snapshot();
      snap.order_id = orderId;
      return snap;
    });
  }

  /** Step 2 — Factory trims quantities it cannot fulfil. Never above what was requested. */
  saveApproval(payload) {
    return this._idempotent(payload.request_id, () => {
      const order = this._order(payload.order_id);
      if (order.status !== "Pending" && order.status !== "Adjusted") {
        throw new ApiError("err.badState", { status: order.status });
      }
      const byProduct = new Map((payload.items || []).map((i) => [i.product_id, toInt(i.approved_qty, 0)]));
      this._itemsOf(order.order_id).forEach((item) => {
        if (!byProduct.has(item.product_id)) return;
        const next = byProduct.get(item.product_id);
        if (next < 0) throw new ApiError("err.negative");
        if (next > item.requested_qty) throw new ApiError("err.overRequested");
        item.approved_qty = next;
      });
      order.status = "Adjusted";
      order.adjusted_by = String(payload.adjusted_by || "").trim();
      order.adjusted_at = new Date().toISOString();
      return this.snapshot();
    });
  }

  /**
   * Step 3 — Factory dispatches. Stock is re-checked here, not at review time:
   * production may have moved between the two clicks.
   */
  dispatchOrder(payload) {
    return this._idempotent(payload.request_id, () => {
      const order = this._order(payload.order_id);
      if (order.status !== "Adjusted") {
        throw new ApiError("err.badState", { status: order.status });
      }
      const who = String(payload.dispatched_by || "").trim();
      if (!who) throw new ApiError("stamp.required");

      const items = this._itemsOf(order.order_id).filter((i) => i.approved_qty > 0);
      if (!items.length) throw new ApiError("err.emptyOrder");

      // Validate the whole order before touching a single number.
      for (const item of items) {
        const have = toInt(this.state.factory_stock[item.product_id], 0);
        if (item.approved_qty > have) {
          const p = this._product(item.product_id);
          throw new ApiError("err.insufficient", {
            name: p.product_name, have, want: item.approved_qty, unit: p.unit,
          });
        }
      }
      items.forEach((item) => {
        this.state.factory_stock[item.product_id] =
          toInt(this.state.factory_stock[item.product_id], 0) - item.approved_qty;
      });
      order.status = "Dispatched";
      order.dispatched_by = who;
      order.dispatched_at = new Date().toISOString();
      this._rememberStaff(who);
      return this.snapshot();
    });
  }

  /** Step 4 — Shop checks the delivery in and the goods land in Shop_Stock. */
  receiveOrder(payload) {
    return this._idempotent(payload.request_id, () => {
      const order = this._order(payload.order_id);
      if (order.status !== "Dispatched") {
        throw new ApiError("err.badState", { status: order.status });
      }
      const who = String(payload.received_by || "").trim();
      if (!who) throw new ApiError("stamp.required");

      this._itemsOf(order.order_id).forEach((item) => {
        if (item.approved_qty <= 0) return;
        this.state.shop_stock[item.product_id] =
          toInt(this.state.shop_stock[item.product_id], 0) + item.approved_qty;
      });
      order.status = "Completed";
      order.received_by = who;
      order.received_at = new Date().toISOString();
      this._rememberStaff(who);
      return this.snapshot();
    });
  }

  /** Shop may withdraw an order the factory has not sent yet. */
  cancelOrder(payload) {
    return this._idempotent(payload.request_id, () => {
      const order = this._order(payload.order_id);
      const reason = String(payload.reason || "").trim();
      if (!reason) throw new ApiError("order.cancelReasonRequired");
      if (order.status !== "Pending" && order.status !== "Adjusted") {
        throw new ApiError("err.badState", { status: order.status });
      }
      order.status = "Cancelled";
      order.note = order.note ? `${order.note} — Cancelled: ${reason}` : `Cancelled: ${reason}`;
      return this.snapshot();
    });
  }

  /** Factory may deny an untouched new order. */
  denyOrder(payload) {
    return this._idempotent(payload.request_id, () => {
      const order = this._order(payload.order_id);
      if (order.status !== "Pending") {
        throw new ApiError("err.badState", { status: order.status });
      }
      order.status = "Denied";
      return this.snapshot();
    });
  }
}
