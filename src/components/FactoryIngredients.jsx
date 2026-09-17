import React, { useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, InlineError, Modal, SectionHead, StatTile, Stepper, inputCls } from "./ui.jsx";
import { categoryName, productName } from "../lib/i18n.js";
import { categoriesOf, productVisible, stockOf } from "../hooks/useInventory.js";
import { CategorySummary } from "./CategorySummary.jsx";

/** Just the clock time (Bangkok) — business_date already shows the date, so this sits beside it without repeating it. */
function formatReportTime(iso, lang) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const locale = lang === "th" ? "th-TH-u-ca-gregory" : lang === "lo" ? "lo-LA" : "en-GB";
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(date);
}

export function FactoryIngredients({ data, t, lang, busy, actions, pushToast, owner = false }) {
  const [open, setOpen] = useState(false);
  const [produced, setProduced] = useState({});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [reportCategory, setReportCategory] = useState("all");
  const [recentDate, setRecentDate] = useState("");
  const products = data.products.filter((product) => product.active !== false && productVisible(data, "factory", product.product_id));
  const reportProducts = products.filter((product) => reportCategory === "all" || product.category === reportCategory);
  const reports = useMemo(() => [...(data.factory_stock_requests || [])].sort((a, b) =>
    new Date(b.requested_at || b.business_date) - new Date(a.requested_at || a.business_date)), [data]);
  const pending = reports.filter((request) => request.status === "Pending");
  // One production report per business day in practice, so picking a date is a
  // more direct way in than paging through them in order.
  const decided = reports.filter((request) => request.status !== "Pending");
  const recentDates = [...new Set(decided.map((request) => request.business_date))]
    .sort((a, b) => new Date(b) - new Date(a));
  const effectiveRecentDate = recentDates.includes(recentDate) ? recentDate : recentDates[0] || "";
  const recentForDate = decided.filter((request) => request.business_date === effectiveRecentDate);
  const today = new Date().toISOString().slice(0, 10);
  const todayReportIds = new Set(reports.filter((request) => request.business_date === today && request.status !== "Denied").map((request) => request.report_id));
  const todayTotal = (data.factory_stock_request_items || []).filter((item) => todayReportIds.has(item.report_id))
    .reduce((sum, item) => sum + Number(item.produced_quantity || 0), 0);
  // Per-product breakdown of today's reports, so the owner can see what was
  // actually made today without pulling the monthly history CSV.
  const todayByProduct = (() => {
    const totals = new Map();
    (data.factory_stock_request_items || []).filter((item) => todayReportIds.has(item.report_id)).forEach((item) => {
      totals.set(item.product_id, (totals.get(item.product_id) || 0) + Number(item.produced_quantity || 0));
    });
    return [...totals.entries()].filter(([, qty]) => qty > 0);
  })();
  const send = async () => {
    const items = products
      .map((product) => ({ product_id: product.product_id, produced_quantity: Number(produced[product.product_id] || 0) }))
      .filter((item) => item.produced_quantity > 0);
    if (!items.length) { setError(t("err.emptyProduction")); return; }
    try { await actions.createFactoryStockReport({ business_date: new Date().toISOString().slice(0, 10), note, items }); pushToast(t("factory.reportSent")); setOpen(false); }
    catch (e) { setError(t(e.code || "err.title", e.vars)); }
  };
  const decide = async (report_id, approve) => {
    await actions.decideFactoryStockReport({ report_id, approve });
    pushToast(t(approve ? "factory.reportApproved" : "factory.reportDenied"));
  };
  const reportCard = (request, decisions = false) => {
    const items = (data.factory_stock_request_items || []).filter((item) => item.report_id === request.report_id);
    const total = items.reduce((sum, item) => sum + Number(item.produced_quantity || 0), 0);
    return <Card key={request.report_id} className="p-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="grow">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold">
              {request.business_date}
              {request.requested_at ? <span className="font-mono font-normal text-muted"> · {formatReportTime(request.requested_at, lang)}</span> : null}
              {" · "}{request.requested_by}
            </p>
            <Badge tone={request.status === "Approved" ? "green" : request.status === "Denied" ? "red" : "amber"}>{t("status." + request.status)}</Badge>
          </div>
          <p className="text-sm text-muted mt-1">{t("factory.reportTotal", { n: total })}{request.note ? ` · ${request.note}` : ""}</p>
        </div>
        {decisions ? <div className="flex w-full sm:w-auto gap-2 self-end [&>button]:flex-1">
          <Button size="sm" variant="danger" loading={busy === "decideFactoryStockReport:" + request.report_id} onClick={() => decide(request.report_id, false)}>{t("stock.denyRemoval")}</Button>
          <Button size="sm" variant="go" loading={busy === "decideFactoryStockReport:" + request.report_id} onClick={() => decide(request.report_id, true)}>{t("stock.approveRemoval")}</Button>
        </div> : null}
      </div>
      <div className="mt-3 divide-y divide-line">{items.map((item) => {
        const product = data.products.find((p) => p.product_id === item.product_id);
        return <div key={item.product_id} className="py-2 flex justify-between gap-3 text-sm"><span>{productName(product, lang)}</span><strong className="font-mono">{item.produced_quantity || 0}</strong></div>;
      })}</div>
    </Card>;
  };
  return <div className="flex flex-col gap-6">
    {!owner ? <>
      <div className="grid sm:grid-cols-2 gap-3">
        <StatTile label={t("factory.producedToday")} value={todayTotal} tone="go" />
        <StatTile label={t("factory.awaitingApproval")} value={pending.length} tone={pending.length ? "alert" : "neutral"} />
      </div>
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="grow"><h2 className="font-display font-semibold text-lg">{t("factory.productionTitle")}</h2><p className="text-sm text-muted mt-1">{t("factory.productionBody")}</p></div>
        <Button className="w-full sm:w-auto" variant="primary" icon="plus" onClick={() => { setProduced({}); setNote(""); setError(""); setReportCategory("all"); setOpen(true); }}>{t("factory.newReport")}</Button>
      </Card>
      <section className="flex flex-col gap-3">
        <SectionHead title={t("factory.awaitingApproval")} count={pending.length} />
        {pending.length ? pending.map((request) => reportCard(request)) : <Card><EmptyState icon="check" title={t("factory.noPendingProduction")} body={t("factory.noPendingProductionBody")} /></Card>}
      </section>
      <section className="flex flex-col gap-3">
        <SectionHead title={t("factory.recentProduction")} count={decided.length}
          action={recentDates.length > 1 ? <select className={inputCls + " w-auto"} value={effectiveRecentDate}
            onChange={(event) => setRecentDate(event.target.value)}>
            {recentDates.map((date) => <option key={date} value={date}>{date}</option>)}
          </select> : null} />
        {recentForDate.length ? recentForDate.map((request) => reportCard(request)) : <Card><EmptyState icon="list" title={t("factory.noProductionHistory")} /></Card>}
      </section>
      <CategorySummary data={data} location="factory" t={t} />
    </> : null}
    {owner ? <section className="flex flex-col gap-3">
      <StatTile label={t("factory.producedToday")} value={todayTotal} tone="go" />
      {todayByProduct.length ? <Card className="p-4 sm:p-5">
        <h3 className="font-semibold text-ink mb-2">{t("factory.producedTodayDetail")}</h3>
        <div className="divide-y divide-line">
          {todayByProduct.map(([product_id, qty]) => {
            const product = data.products.find((p) => p.product_id === product_id);
            return <div key={product_id} className="py-2 flex justify-between gap-3 text-sm">
              <span>{productName(product, lang)}</span>
              <strong className="font-mono">{qty}</strong>
            </div>;
          })}
        </div>
      </Card> : null}
      <h2 className="font-display font-semibold text-lg">{t("factory.pendingReports")} ({pending.length})</h2>
      {pending.length === 0 ? <Card className="p-5 text-sm text-muted">{t("factory.noReports")}</Card> : pending.map((request) => reportCard(request, true))}
    </section> : null}
    <Modal open={open} onClose={() => setOpen(false)} size="lg" title={t("factory.reportTitle")} description={t("factory.reportBody")} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{t("action.cancel")}</Button><Button variant="primary" loading={busy === "createFactoryStockReport"} onClick={send}>{t("factory.sendReport")}</Button></>}>
      <Field label={t("product.category")}>
        <select className={inputCls} value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}>
          <option value="all">{t("misc.all")} — {t("product.category")}</option>
          {categoriesOf(data).map((category) => <option key={category} value={category}>{categoryName(t, category)}</option>)}
        </select>
      </Field>
      <p className="text-xs text-muted">{t("factory.categoryHint")}</p>
      <div className="divide-y divide-line border border-line rounded-xl overflow-hidden">{reportProducts.map((product) => { const current = stockOf(data, "factory", product.product_id); return <div key={product.product_id} className="p-3 flex items-center gap-3"><div className="grow min-w-0"><p className="font-medium truncate">{productName(product, lang)}</p><p className="text-xs text-muted">{categoryName(t, product.category)} · {t("stock.current")}: {current}</p></div><Field label={t("factory.produced")}><Stepper size="sm" value={Number(produced[product.product_id] || 0)} min={0} onChange={(value) => setProduced((map) => ({ ...map, [product.product_id]: value }))} /></Field></div>; })}</div>
      <Field label={t("stock.note")}><textarea className={`${inputCls} min-h-20 py-2`} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
      {error ? <InlineError>{error}</InlineError> : null}
    </Modal>
  </div>;
}
