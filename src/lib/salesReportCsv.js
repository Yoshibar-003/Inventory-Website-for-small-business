import { categoryName, productName } from "./i18n.js";

/**
 * One shop daily-sales report (a stock_removal_batch + its line items) as
 * standalone spreadsheet rows — independent of the monthly "Export history"
 * file, which mixes every kind of stock movement together. Built entirely
 * client-side since the batch, its items, and the product catalog are
 * already in `data`. Pass the result straight to downloadSheet().
 */
export function buildDailySalesReportRows(batch, items, data, t, lang) {
  const products = new Map((data.products || []).map((p) => [p.product_id, p]));
  const itemRows = items.map((item) => {
    const product = products.get(item.product_id) || {};
    return [
      item.product_id,
      productName(product, lang) || item.product_id,
      categoryName(t, product.category || ""),
      item.quantity,
      t("unit." + (product.unit || "pcs")),
    ];
  });
  const total = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const meta = [
    [t("stock.dailyReport")],
    [t("stock.businessDate"), batch.business_date],
    [t("stock.requestedBy"), batch.requested_by],
    [t("order.status"), t("status." + batch.status)],
    batch.decided_by ? [t("stock.decidedBy"), batch.decided_by] : null,
    batch.note ? [t("order.note"), batch.note] : null,
    [],
    ["Product ID", "Product", "Category", "Quantity Sold", "Unit"],
  ].filter((line) => line !== null);

  const footer = ["", "", "Total", total, ""];
  const rows = [...meta, ...itemRows, footer];
  const filename = `1213-sales-report-${batch.business_date}-${String(batch.batch_id).slice(0, 8)}.xlsx`;
  return { filename, rows };
}
