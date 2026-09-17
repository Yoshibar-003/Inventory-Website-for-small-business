import { categoryName } from "./i18n.js";

/**
 * Renders an ISO timestamp as its Asia/Bangkok (UTC+7) wall-clock time, with
 * an explicit offset since a spreadsheet has no idea the source was UTC.
 */
function toBangkokTimestamp(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 19).replace("T", " ") + " +07:00";
}

/**
 * One order — its lines plus who/when touched it — as standalone spreadsheet
 * rows. Timestamps are converted to Asia/Bangkok (UTC+7), matching every
 * on-screen date/time in the app. Pass the result straight to downloadSheet().
 */
export function buildOrderRows(order, items, data, t) {
  const products = new Map((data.products || []).map((p) => [p.product_id, p]));
  const itemRows = items.map((item) => {
    const product = products.get(item.product_id) || {};
    return [
      item.product_id,
      product.product_name || item.product_id,
      categoryName(t, product.category || ""),
      item.requested_qty,
      item.approved_qty,
      t("unit." + (product.unit || "pcs")),
    ];
  });
  const totalRequested = items.reduce((sum, item) => sum + Number(item.requested_qty || 0), 0);
  const totalApproved = items.reduce((sum, item) => sum + Number(item.approved_qty || 0), 0);

  const meta = [
    [order.order_id],
    [t("order.status"), t("status." + order.status)],
    [t("order.created"), toBangkokTimestamp(order.date)],
    [t("order.createdBy"), order.created_by || ""],
    order.adjusted_by ? [t("order.adjustedBy"), order.adjusted_by, toBangkokTimestamp(order.adjusted_at)] : null,
    order.dispatched_by ? [t("order.dispatchedBy"), order.dispatched_by, toBangkokTimestamp(order.dispatched_at)] : null,
    order.received_by ? [t("order.receivedBy"), order.received_by, toBangkokTimestamp(order.received_at)] : null,
    order.note ? [t("order.note"), order.note] : null,
    [],
    ["Product ID", "Product", "Category", "Requested", "Approved", "Unit"],
  ].filter((line) => line !== null);

  const footer = ["", "", "Total", totalRequested, totalApproved, ""];
  const rows = [...meta, ...itemRows, footer];
  const filename = `1213-order-${order.order_id}.xlsx`;
  return { filename, rows };
}
