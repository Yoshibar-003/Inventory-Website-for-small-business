import { itemsOf, productMap } from "../hooks/useInventory.js";
import { categoryName, productName } from "./i18n.js";
import notoThai400 from "@fontsource/noto-sans-thai/files/noto-sans-thai-thai-400-normal.woff2?url";
import notoThai500 from "@fontsource/noto-sans-thai/files/noto-sans-thai-thai-500-normal.woff2?url";
import notoThai600 from "@fontsource/noto-sans-thai/files/noto-sans-thai-thai-600-normal.woff2?url";
import notoThai700 from "@fontsource/noto-sans-thai/files/noto-sans-thai-thai-700-normal.woff2?url";
import phetsarath400 from "@fontsource/phetsarath/files/phetsarath-lao-400-normal.woff2?url";
import phetsarath700 from "@fontsource/phetsarath/files/phetsarath-lao-700-normal.woff2?url";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[ch]));

function formatReceiptDate(iso, lang) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const locale = lang === "th" ? "th-TH-u-ca-gregory" : lang === "lo" ? "lo-LA" : "en-GB";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok",
  }).format(date);
}

export function openOrderReceipt(order, data, t, lang) {
  if (!order) return;
  const products = productMap(data);
  const items = itemsOf(data, order.order_id);
  const total = items.reduce((sum, item) => sum + Number(item.approved_qty || 0), 0);
  const rows = items.map((item) => {
    const product = products[item.product_id] || {};
    return `<tr><td><strong>${esc(productName(product, lang))}</strong><small>${esc(item.product_id)} · ${esc(categoryName(t, product.category || ""))} · ${esc(t("unit." + (product.unit || "pcs")))}</small></td><td>${esc(item.requested_qty)}</td><td>${esc(item.approved_qty)}</td></tr>`;
  }).join("");

  // Same stage progression as the in-app OrderDetail timeline, so the printed
  // receipt and the on-screen view never disagree about what "done" means.
  const reached = { Pending: 1, Adjusted: 2, Dispatched: 3, Completed: 4, Cancelled: 1, Denied: 1 }[order.status] || 1;
  const steps = [
    { label: t("status.Pending"), who: order.created_by, when: formatReceiptDate(order.date, lang), done: reached >= 1 },
    { label: t("status.Adjusted"), who: order.adjusted_by, when: formatReceiptDate(order.adjusted_at, lang), done: reached >= 2 },
    { label: t("status.Dispatched"), who: order.dispatched_by, when: formatReceiptDate(order.dispatched_at, lang), done: reached >= 3 },
    { label: t("status.Completed"), who: order.received_by, when: formatReceiptDate(order.received_at, lang), done: reached >= 4 },
  ];
  const timelineHtml = steps.map((step) =>
    `<li class="${step.done ? "done" : ""}"><span class="dot"></span><div><p class="step-label">${esc(step.label)}</p><p class="step-meta">${step.who ? esc(step.who) : "—"}${step.when ? " · " + esc(step.when) : ""}</p></div></li>`
  ).join("");

  const win = window.open("", "_blank");
  if (!win) return;
  win.opener = null;
  win.document.write(`<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(t("receipt.title"))} ${esc(order.order_id)}</title><style>
@font-face{font-family:"Noto Sans Thai";font-style:normal;font-weight:400;src:url("${notoThai400}") format("woff2")}@font-face{font-family:"Noto Sans Thai";font-style:normal;font-weight:500;src:url("${notoThai500}") format("woff2")}@font-face{font-family:"Noto Sans Thai";font-style:normal;font-weight:600;src:url("${notoThai600}") format("woff2")}@font-face{font-family:"Noto Sans Thai";font-style:normal;font-weight:700;src:url("${notoThai700}") format("woff2")}@font-face{font-family:"Phetsarath";font-style:normal;font-weight:400;src:url("${phetsarath400}") format("woff2")}@font-face{font-family:"Phetsarath";font-style:normal;font-weight:700;src:url("${phetsarath700}") format("woff2")}
*{box-sizing:border-box}body{margin:0;background:#faf7e8;color:#10100e;font-family:Arial,"Noto Sans Thai",sans-serif}html[lang="th"] body{font-family:"Noto Sans Thai",Arial,sans-serif;font-weight:500;letter-spacing:.01em;line-height:1.7}html[lang="lo"] body{font-family:"Phetsarath","Noto Sans Thai",sans-serif;font-weight:500;letter-spacing:.015em;line-height:1.75}.page{width:min(760px,calc(100% - 24px));margin:28px auto;background:#fffdf4;padding:40px;border-radius:16px;box-shadow:0 8px 30px #3c362018}.head{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #10100e;padding-bottom:20px}.brand{font-size:24px;font-weight:800}.muted,small{color:#67624e}.meta{text-align:right}.meta strong,.meta span{display:block}.status{display:inline-block;margin:20px 0;padding:6px 10px;border-radius:999px;background:#ebe5cd;font-size:12px;font-weight:700;text-transform:uppercase}table{width:100%;border-collapse:collapse}th{font-size:12px;text-transform:uppercase;color:#67624e;text-align:left;border-bottom:1px solid #cfc6a5;padding:10px 8px}td{padding:13px 8px;border-bottom:1px solid #e8e1c6}th:nth-child(n+2),td:nth-child(n+2){text-align:right}td small{display:block;margin-top:3px}.total{display:flex;justify-content:flex-end;gap:30px;font-size:18px;font-weight:800;margin-top:20px}.note{margin-top:18px;font-size:13px;color:#67624e}.timeline{list-style:none;margin:28px 0 0;padding:20px 0 0;border-top:1px solid #cfc6a5;display:flex;flex-direction:column;gap:0}.timeline li{display:flex;gap:10px;padding:6px 0;opacity:.45}.timeline li.done{opacity:1}.timeline .dot{width:9px;height:9px;border-radius:999px;background:#cfc6a5;margin-top:5px;flex:none}.timeline li.done .dot{background:#121210}.step-label{font-size:13px;font-weight:700;margin:0}.step-meta{font-size:12px;color:#67624e;margin:2px 0 0}.actions{position:sticky;bottom:0;text-align:center;margin:20px;padding:12px;background:#faf7e8e8}.actions button{border:0;border-radius:9px;padding:12px 20px;background:#121210;color:#fffcee;font-family:inherit;font-size:inherit;font-weight:600;letter-spacing:inherit;line-height:inherit;cursor:pointer;margin:4px}.actions .back{background:#fffdf4;color:#121210}@media(max-width:560px){.page{margin:0;width:100%;border-radius:0;padding:24px}.head{display:block}.meta{text-align:left;margin-top:14px}.actions{margin:0}}@media print{body{background:#fff}.page{width:100%;margin:0;padding:18mm;box-shadow:none;border-radius:0}.actions{display:none}}
</style></head><body><div class="page"><div class="head"><div><div class="brand">1213 Ice Cream</div><div class="muted">${esc(t("receipt.subtitle"))}</div></div><div class="meta"><strong>${esc(order.order_id)}</strong><span class="muted">${esc(formatReceiptDate(order.date, lang))}</span></div></div><span class="status">${esc(t("status." + order.status))}</span><table><thead><tr><th>${esc(t("stock.product"))}</th><th>${esc(t("order.requested"))}</th><th>${esc(t("order.approved"))}</th></tr></thead><tbody>${rows}</tbody></table><div class="total"><span>${esc(t("misc.total"))}</span><span>${esc(total)}</span></div>${order.note ? `<p class="note"><b>${esc(t("order.note"))}:</b> ${esc(order.note)}</p>` : ""}<ol class="timeline">${timelineHtml}</ol></div><div class="actions"><button class="back">${esc(t("receipt.back"))}</button><button class="print">${esc(t("receipt.print"))}</button></div></body></html>`);
  win.document.close();
  win.document.querySelector(".back")?.addEventListener("click", () => {
    if (win.history.length > 1) win.history.back();
    else win.close();
  });
  win.document.querySelector(".print")?.addEventListener("click", () => {
    win.document.fonts.ready.then(() => win.print());
  });
}
