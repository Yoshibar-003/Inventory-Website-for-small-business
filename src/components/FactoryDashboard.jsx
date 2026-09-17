import React, { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, InlineError, Modal, SectionHead, Segmented, StatTile, Stepper, cx } from "./ui.jsx";
import { OrderCard, OrderDetail, formatWhen } from "./orders.jsx";
import { StockPanel } from "./StockPanel.jsx";
import { FactoryIngredients } from "./FactoryIngredients.jsx";
import { productName } from "../lib/i18n.js";
import { itemsOf, orderTotals, ordersByStatus, productMap, stockOf } from "../hooks/useInventory.js";
import { openOrderReceipt } from "../lib/receipt.js";
import { buildOrderRows } from "../lib/orderCsv.js";
import { downloadSheet } from "../lib/xlsxExport.js";

/**
 * Step 2 — review and trim. The factory can only ever reduce a line: approving more
 * than the shop asked for would arrive as a surprise nobody has freezer space for.
 */
export function ReviewModal({ order, data, t, lang, onClose, onSave, busy }) {
  const [approved, setApproved] = useState({});
  const [error, setError] = useState("");

  const items = order ? itemsOf(data, order.order_id) : [];
  const products = productMap(data);

  useEffect(() => {
    if (!order) return;
    const seed = {};
    itemsOf(data, order.order_id).forEach((i) => (seed[i.product_id] = Number(i.approved_qty)));
    setApproved(seed);
    setError("");
  }, [order && order.order_id]);

  if (!order) return null;

  const rows = items.map((item) => {
    const have = stockOf(data, "factory", item.product_id);
    const value = approved[item.product_id] === undefined ? Number(item.approved_qty) : approved[item.product_id];
    return { item, have, value, short: Math.max(0, value - have), product: products[item.product_id] || {} };
  });

  const blocked = rows.some((r) => r.short > 0);
  const totalApproved = rows.reduce((s, r) => s + r.value, 0);
  const totalRequested = rows.reduce((s, r) => s + Number(r.item.requested_qty), 0);

  const capToStock = () => {
    const next = {};
    rows.forEach((r) => (next[r.item.product_id] = Math.min(r.value, r.have)));
    setApproved(next);
    setError("");
  };
  const approveAll = () => {
    const next = {};
    rows.forEach((r) => (next[r.item.product_id] = Number(r.item.requested_qty)));
    setApproved(next);
  };

  const payload = () => ({
    order_id: order.order_id,
    items: rows.map((r) => ({ product_id: r.item.product_id, approved_qty: r.value })),
  });

  const save = async () => {
    try {
      await onSave(payload());
      onClose();
    } catch (e) {
      setError(t(e.code || "err.title", e.vars));
    }
  };

  return (
    <Modal
      open={Boolean(order)}
      onClose={onClose}
      size="lg"
      title={order.order_id}
      description={order.note || t("order.lines")}
      footer={
        <div className="flex items-center justify-between gap-3 w-full flex-wrap">
          <p className="text-sm text-muted tabular-nums">
            {t("order.approved")}{" "}
            <span className="font-mono font-semibold text-ink">{totalApproved}</span>
            <span className="mx-1">/</span>
            <span className="font-mono">{totalRequested}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>{t("action.cancel")}</Button>
            <Button variant="primary" icon="check" onClick={save} loading={busy === "saveApproval"} disabled={blocked || totalApproved === 0}>
              {t("action.approveOrder")}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={approveAll}>{t("action.approveAll")}</Button>
          <Button size="sm" onClick={capToStock}>{t("action.capToStock")}</Button>
          <span className="text-[13px] text-muted ml-auto tabular-nums">{formatWhen(order.date, lang)}</span>
        </div>

        {blocked ? <InlineError>{t("err.insufficientShort")}</InlineError> : null}

        <ul className="rounded-xl border border-line divide-y divide-line overflow-hidden">
          <li className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_5rem_5rem_auto] gap-3 items-center px-4 py-2
                         bg-surface2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            <span>{t("stock.product")}</span>
            <span className="text-right hidden sm:block">{t("order.requested")}</span>
            <span className="text-right hidden sm:block">{t("order.available")}</span>
            <span className="text-right">{t("order.approved")}</span>
          </li>
          {rows.map(({ item, have, value, short, product }) => (
            <li key={item.product_id}
              className={cx("grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_5rem_5rem_auto] gap-3 items-center px-4 py-2.5",
                short > 0 && "bg-redTint")}>
              <div className="min-w-0">
                <p className="text-sm text-ink truncate">{productName(product, lang)}</p>
                <p className="text-[12px] text-muted sm:hidden tabular-nums">
                  {t("order.requested")} {item.requested_qty} · {t("order.available")} {have}
                </p>
                {short > 0 ? <Badge tone="red" className="mt-1">{t("order.shortfall", { n: short })}</Badge> : null}
              </div>
              <span className="hidden sm:block text-right font-mono tabular-nums text-sm text-muted">
                {item.requested_qty}
              </span>
              <span className={cx("hidden sm:block text-right font-mono tabular-nums text-sm",
                have < value ? "text-red font-semibold" : "text-muted")}>
                {have}
              </span>
              <Stepper size="sm" value={value} max={Number(item.requested_qty)} label={productName(product, lang)}
                onChange={(v) => { setApproved((a) => ({ ...a, [item.product_id]: v })); setError(""); }} />
            </li>
          ))}
        </ul>

        {error ? <InlineError>{error}</InlineError> : null}
      </div>
    </Modal>
  );
}

export function FactoryDashboard({ data, t, lang, busy, actions, pushToast }) {
  const [tab, setTab] = useState("queue");
  const [reviewing, setReviewing] = useState(null);
  const [detail, setDetail] = useState(null);

  const queue = useMemo(() => ordersByStatus(data, ["Pending", "Adjusted"]), [data]);
  const pending = queue.filter((o) => o.status === "Pending");
  const inTransit = useMemo(() => ordersByStatus(data, ["Dispatched"]), [data]);
  const done = useMemo(() => ordersByStatus(data, ["Completed", "Cancelled", "Denied"]), [data]);

  const unitsToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return data.orders
      .filter((o) => o.dispatched_at && String(o.dispatched_at).slice(0, 10) === today)
      .reduce((sum, o) => sum + orderTotals(data, o.order_id).approved, 0);
  }, [data]);

  const reviewingOrder = reviewing ? data.orders.find((o) => o.order_id === reviewing) : null;
  const detailOrder = detail ? data.orders.find((o) => o.order_id === detail) : null;

  const saveApproval = async (p) => {
    await actions.saveApproval(p);
    pushToast(t("toast.adjusted", { id: p.order_id }));
  };

  const deny = async (orderId) => {
    if (!window.confirm(t("order.denyConfirm", { id: orderId }))) return;
    await actions.denyOrder({ order_id: orderId });
    pushToast(t("toast.denied", { id: orderId }));
    setReviewing(null);
    setDetail(null);
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "queue", label: t("tab.queue"), icon: "factory" },
          { value: "stock", label: t("tab.stock"), icon: "box" },
          { value: "reports", label: `${t("factory.pendingReports")} (${(data.factory_stock_requests || []).filter((request) => request.status === "Pending").length})`, icon: "list" },
        ]}
      />

      {tab === "queue" ? (
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label={t("stat.pendingReview")} value={pending.length}
              tone={pending.length ? "alert" : "neutral"} />
            <StatTile label={t("stat.readyToDispatch")} value={queue.length - pending.length} />
            <StatTile label={t("stat.awaitingReceipt")} value={inTransit.length} />
            <StatTile label={t("stat.unitsToday")} value={unitsToday} tone="go" />
          </div>

          <section className="flex flex-col gap-3">
            <SectionHead title={t("tab.queue")} count={queue.length} />
            {queue.length === 0 ? (
              <Card><EmptyState icon="factory" title={t("order.emptyFactory")} /></Card>
            ) : (
              queue.map((order) => (
                <OrderCard key={order.order_id} order={order} data={data} t={t} lang={lang}
                  attention={order.status === "Pending"} onOpen={() => setDetail(order.order_id)}
                  action={<>
                    {order.status === "Pending" ? <Button size="sm" variant="danger" onClick={() => deny(order.order_id)}
                      loading={busy === "denyOrder"}>{t("action.denyOrder")}</Button> : null}
                    <Button size="sm" variant="primary" icon="list" onClick={() => setReviewing(order.order_id)}>
                      {t("action.review")}
                    </Button>
                  </>} />
              ))
            )}
          </section>

          {inTransit.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
                {t("stat.awaitingReceipt")}
              </h3>
              {inTransit.map((order) => (
                <OrderCard key={order.order_id} order={order} data={data} t={t} lang={lang}
                  onOpen={() => setDetail(order.order_id)} />
              ))}
            </section>
          ) : null}

          {done.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
                {t("status.Completed")}
              </h3>
              {done.slice(0, 6).map((order) => (
                <OrderCard key={order.order_id} order={order} data={data} t={t} lang={lang}
                  onOpen={() => setDetail(order.order_id)} />
              ))}
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === "stock" ? (
          <StockPanel
          data={data} location="factory" showBoth t={t} lang={lang} busy={busy} categoryActions={actions}
          onExportMonthly={(payload) => actions.exportMonthlyStockCsv(payload)}
          onSaveAll={(payload) => actions.setStockBatch(payload)}
          onSave={(product_id, new_quantity, reason) =>
            actions.setStock({ location: "factory", product_id, new_quantity, reason })}
          onEditProduct={(payload) => actions.editProduct(payload).then(() => pushToast(t("product.updated")))}
          onSaved={() => pushToast(t("stock.saved"))}
          onAddProduct={(form) => actions.addProduct(form).then(() => pushToast(t("product.added")))}
          onArchiveProduct={(product_id) => actions.archiveProduct({ product_id }).then(() => pushToast(t("product.deleted")))}
          onSetLocationActive={(payload) => actions.setProductLocationActive(payload).then(() => pushToast(t(payload.active ? "stock.publishedShop" : "stock.hiddenLocation")))}
        />
      ) : null}

      {tab === "reports" ? <FactoryIngredients data={data} t={t} lang={lang} busy={busy} actions={actions} pushToast={pushToast} owner /> : null}

      <ReviewModal
        order={reviewingOrder} data={data} t={t} lang={lang} busy={busy}
        onClose={() => setReviewing(null)} onSave={saveApproval}
      />

      <OrderDetail
        order={detailOrder} data={data} t={t} lang={lang} onClose={() => setDetail(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetail(null)}>{t("order.close")}</Button>
            {detailOrder ? <Button icon="list" onClick={() => openOrderReceipt(detailOrder, data, t, lang)}>{t("action.receipt")}</Button> : null}
            {detailOrder ? <Button icon="list" variant="ghost" onClick={() => {
              const report = buildOrderRows(detailOrder, itemsOf(data, detailOrder.order_id), data, t);
              downloadSheet(report.filename, report.rows, { lang });
            }}>{t("action.downloadCsv")}</Button> : null}
            {detailOrder && (detailOrder.status === "Pending" || detailOrder.status === "Adjusted") ? (
              <Button variant="primary" icon="list"
                onClick={() => { setReviewing(detailOrder.order_id); setDetail(null); }}>
                {t("action.review")}
              </Button>
            ) : null}
            {detailOrder && detailOrder.status === "Pending" ? (
              <Button variant="danger" onClick={() => deny(detailOrder.order_id)} loading={busy === "denyOrder"}>
                {t("action.denyOrder")}
              </Button>
            ) : null}
          </>
        }
      />
    </div>
  );
}
