import { MockDb } from "./mockDb.js";

const db = new MockDb();
let stockVisibility = { shop: {}, factory: {} };
let categories = [...new Set(db.state.products.map((product) => product.category))];
db.state.products.forEach((product) => { stockVisibility.shop[product.product_id] = true; stockVisibility.factory[product.product_id] = true; });
let currentUser = { name: "Owner", role: "owner" };
let accounts = [
  { name: "Owner", role: "owner", active: true, pin: "1234", last_used: "" },
  { name: "Shop Employee", role: "employee", active: true, pin: "1111", last_used: "" },
  { name: "Factory Employee", role: "factory_employee", active: true, pin: "2222", last_used: "" },
  { name: "Manager", role: "manager", active: true, pin: "3333", last_used: "" },
];

function snapshot() {
  const data = db.snapshot();
  // db.snapshot() doesn't carry stock_removal_batches (unlike stock_requests,
  // which it already returns) — pull it from state directly, or every daily
  // report gets silently wiped back to an empty list on the next snapshot.
  data.stock_removal_batches = db.state.stock_removal_batches || [];
  data.stock_requests ||= [];
  data.factory_stock_requests = db.state.factory_stock_requests || [];
  data.factory_stock_request_items = db.state.factory_stock_request_items || [];
  data.categories = categories.map((name, sort_order) => ({ name, sort_order }));
  data.stock_visibility = JSON.parse(JSON.stringify(stockVisibility));
  return data;
}
const fail = (code) => { throw Object.assign(new Error(code), { code }); };

export async function localMockCall(action, payload = {}) {
  if (action === "login") {
    const account = accounts.find((item) => item.active && item.name.toLowerCase() === String(payload.name).trim().toLowerCase() && item.pin === String(payload.pin));
    if (!account) fail("err.login");
    currentUser = { name: account.name, role: account.role };
    return { ...currentUser, token: "local-demo-token", expires_at: Date.now() + 3600000, snapshot: snapshot() };
  }
  if (action === "bootstrap") return snapshot();
  // Demo mode has no server to hold subscriptions or send pushes — the
  // browser-side subscribe still happens for real, this just no-ops the
  // round trip so the UI doesn't error out.
  if (action === "pushSubscribe" || action === "pushUnsubscribe") return { ok: true };
  if (action === "staffAccounts") return accounts.filter((item) => item.active).map(({ pin, ...item }) => item);
  if (action === "saveStaffAccount") {
    const found = accounts.find((item) => item.name.toLowerCase() === String(payload.name).trim().toLowerCase());
    if (found) { const oldPin = found.pin; Object.assign(found, payload); if (!payload.pin) found.pin = oldPin; }
    else accounts.push({ ...payload, active: true });
    return localMockCall("staffAccounts");
  }
  if (action === "deleteStaffAccount") {
    const found = accounts.find((item) => item.name.toLowerCase() === String(payload.name).trim().toLowerCase());
    if (found?.role === "owner") fail("staff.cannotDeleteOwner");
    if (found) found.active = false;
    return localMockCall("staffAccounts");
  }
  if (action === "addCategory") { const name = String(payload.name || "").trim(); if (!name) fail("category.nameRequired"); if (!categories.some((item) => item.toLowerCase() === name.toLowerCase())) categories.push(name); return snapshot(); }
  if (action === "renameCategory") { const oldName = String(payload.old_name || ""); const newName = String(payload.new_name || "").trim(); if (!newName) fail("category.nameRequired"); categories = categories.map((name) => name === oldName ? newName : name); db.state.products.forEach((product) => { if (product.category === oldName) product.category = newName; }); return snapshot(); }
  if (action === "deleteCategory") { const name = String(payload.name || ""); if (db.state.products.some((product) => product.category === name)) fail("category.notEmpty"); categories = categories.filter((item) => item !== name); return snapshot(); }
  if (action === "setProductCategory") { const product = db.state.products.find((item) => item.product_id === payload.product_id); if (!product || !categories.includes(payload.category)) fail("err.badState"); product.category = payload.category; return snapshot(); }
  if (action === "editProduct") {
    const oldId = String(payload.product_id || "");
    const newId = String(payload.new_product_id || "").trim();
    db.editProduct(payload);
    if (newId && newId !== oldId) {
      ["shop", "factory"].forEach((loc) => {
        if (Object.prototype.hasOwnProperty.call(stockVisibility[loc], oldId)) {
          stockVisibility[loc][newId] = stockVisibility[loc][oldId];
          delete stockVisibility[loc][oldId];
        }
      });
    }
    return snapshot();
  }
  if (action === "addProduct") { const data = db.addProduct(payload); const product = data.products[data.products.length - 1]; stockVisibility.factory[product.product_id] = true; stockVisibility.shop[product.product_id] = Boolean(payload.publish_to_shop); return snapshot(); }
  if (action === "setProductLocationActive") { const location = payload.location === "factory" ? "factory" : "shop"; stockVisibility[location][payload.product_id] = Boolean(payload.active); return snapshot(); }
  if (action === "archiveProduct") return db.archiveProduct(payload);
  if (action === "setStock") return db.setStock(payload);
  if (action === "setStockBatch") { (payload.items || []).forEach((item) => db.setStock({ location: payload.location, product_id: item.product_id, new_quantity: item.quantity })); return snapshot(); }
  if (action === "createOrder") return db.createOrder({ ...payload, created_by: currentUser.name });
  if (action === "saveApproval") return db.saveApproval({ ...payload, adjusted_by: currentUser.name });
  if (action === "dispatchOrder") {
    if (currentUser.role !== "factory_employee") fail("err.forbidden");
    return db.dispatchOrder({ ...payload, dispatched_by: currentUser.name });
  }
  if (action === "receiveOrder") return db.receiveOrder({ ...payload, received_by: currentUser.name });
  if (action === "cancelOrder") return db.cancelOrder(payload);
  if (action === "denyOrder") return db.denyOrder(payload);
  if (action === "createStockAdditionOrder") {
    const book = payload.location === "factory" ? db.state.factory_stock : db.state.shop_stock;
    (payload.items || []).forEach((item) => { book[item.product_id] = Number(book[item.product_id] || 0) + Number(item.quantity || 0); });
    return snapshot();
  }
  if (action === "requestDailyStockReport") {
    db.state.stock_removal_batches ||= []; db.state.stock_requests ||= [];
    const batch_id = "LOCAL-BATCH-" + (db.state.stock_removal_batches.length + 1);
    db.state.stock_removal_batches.push({ batch_id, location: payload.location, business_date: payload.business_date, note: payload.note || "", status: "Pending", requested_by: currentUser.name });
    (payload.items || []).forEach((item, index) => db.state.stock_requests.push({ request_id: `${batch_id}-${index}`, batch_id, location: payload.location, product_id: item.product_id, quantity: item.quantity, status: "Pending", requested_by: currentUser.name }));
    return snapshot();
  }
  if (action === "decideDailyStockReport") {
    const batch = db.state.stock_removal_batches.find((item) => item.batch_id === payload.batch_id);
    const items = db.state.stock_requests.filter((item) => item.batch_id === payload.batch_id);
    if (payload.approve) items.forEach((item) => { const book = item.location === "factory" ? db.state.factory_stock : db.state.shop_stock; book[item.product_id] -= Number(item.quantity); item.status = "Approved"; });
    else items.forEach((item) => { item.status = "Denied"; });
    if (batch) { batch.status = payload.approve ? "Approved" : "Denied"; batch.decided_by = currentUser.name; batch.decided_at = new Date().toISOString(); }
    return snapshot();
  }
  if (action === "createFactoryStockReport") {
    db.state.factory_stock_requests ||= []; db.state.factory_stock_request_items ||= [];
    const report_id = "LOCAL-FR-" + (db.state.factory_stock_requests.length + 1);
    db.state.factory_stock_requests.push({ report_id, business_date: payload.business_date, note: payload.note || "", status: "Pending", requested_by: currentUser.name, requested_at: new Date().toISOString() });
    (payload.items || []).forEach((item) => db.state.factory_stock_request_items.push({ report_id, product_id: item.product_id, quantity: Math.max(0, Number(item.quantity || 0)), produced_quantity: Math.max(0, Number(item.produced_quantity || 0)) }));
    return snapshot();
  }
  if (action === "decideFactoryStockReport") {
    // NOTE: identified by report_id, deliberately distinct from the payload's own
    // request_id (added by api.js as an idempotency key for every call). Reusing
    // "request_id" for both meanings caused the id we need to look up here to get
    // clobbered by the random idempotency key before it ever reached this function.
    const request = (db.state.factory_stock_requests || []).find((item) => item.report_id === payload.report_id);
    if (!request || request.status !== "Pending") fail("err.badState");
    // Approval only ever adds what was produced — it never overwrites the on-hand
    // count, so a report can't accidentally erase stock nobody reported on.
    if (payload.approve) (db.state.factory_stock_request_items || []).filter((item) => item.report_id === payload.report_id).forEach((item) => { db.state.factory_stock[item.product_id] = Number(db.state.factory_stock[item.product_id] || 0) + Number(item.produced_quantity || 0); });
    request.status = payload.approve ? "Approved" : "Denied"; request.decided_by = currentUser.name; request.decided_at = new Date().toISOString();
    return snapshot();
  }  if (action === "exportMonthlyStockCsv") {
    const mod = await import("exceljs");
    const ExcelJS = mod.default || mod;
    const { siteFontFor } = await import("./xlsxExport.js");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Stock History");
    worksheet.addRow(["Date", "Type", "Location", "Product ID", "Product", "Quantity", "Stock Change", "Staff", "Note"]);
    [12, 16, 10, 12, 24, 10, 14, 14, 24].forEach((width, i) => { worksheet.getColumn(i + 1).width = width; });
    const font = siteFontFor(payload.lang);
    worksheet.eachRow((row) => { row.font = { name: font, size: 11 }; });
    const buffer = await workbook.xlsx.writeBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const base64 = btoa(binary);
    return { filename: `1213-local-${payload.start_date || payload.month}-to-${payload.end_date || payload.month}.xlsx`, base64 };
  }
  fail("err.title");
}
