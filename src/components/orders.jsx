import React, { useEffect, useState } from "react";
import { Badge, Button, Card, Field, Icon, InlineError, Modal, StatusPill, cx, inputCls } from "./ui.jsx";
import { productName } from "../lib/i18n.js";
import { itemsOf, orderTotals, productMap, shortfalls } from "../hooks/useInventory.js";

/** Bangkok time, Gregorian years even in Thai (th-TH defaults to the Buddhist era). */
export function formatWhen(iso, lang, withTime = true) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const locale = lang === "th" ? "th-TH-u-ca-gregory" : "en-GB";
  const opts = withTime
    ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }
    : { day: "numeric", month: "short", timeZone: "Asia/Bangkok" };
  return new Intl.DateTimeFormat(locale, opts).format(date);
}

/** One row in the order lists. `attention` lifts the card that needs a human next. */
export function OrderCard({ order, data, t, lang, attention, onOpen, action }) {
  const totals = orderTotals(data, order.order_id);
  return (
    <Card
      className={cx(
        "flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 transition-shadow",
        attention ? "border-brand/40 shadow-soft" : "hover:border-line2"
      )}
    >
      <div className="grow min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button type="button" onClick={onOpen}
            className="font-mono text-sm font-semibold text-ink hover:text-brandStrong focus-ring rounded">
            {order.order_id}
          </button>
          <StatusPill status={order.status} t={t} />
          {totals.trimmed > 0 && order.status !== "Completed" ? (
            <Badge tone="steel">{t("order.adjustedNotice", { n: totals.trimmed })}</Badge>
          ) : null}
        </div>
        <p className="text-[13px] text-muted mt-1 flex items-center gap-2 flex-wrap tabular-nums">
          <span>{formatWhen(order.date, lang)}</span>
          <span aria-hidden="true">·</span>
          <span>{t("order.items", { n: totals.lines })}</span>
          <span aria-hidden="true">·</span>
          <span>{t("order.units", { n: totals.approved })}</span>
          {order.created_by ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{t("order.createdBy")} {order.created_by}</span>
            </>
          ) : null}
        </p>
      </div>
      <div className="w-full sm:w-auto shrink-0 flex items-center justify-end gap-2 [&>button]:min-w-11">
        {action}
        <Button size="sm" variant="ghost" onClick={onOpen} aria-label={t("order.viewDetail")}>
          <Icon name="arrow" />
        </Button>
      </div>
    </Card>
  );
}

function TimelineStep({ done, label, who, when, last }) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={cx("w-2.5 h-2.5 rounded-full mt-1.5 shrink-0", done ? "bg-brand" : "bg-line2")} />
        {!last ? <span className={cx("w-px grow my-1", done ? "bg-brand/40" : "bg-line")} /> : null}
      </div>
      <div className={cx("pb-4", !done && "opacity-45")}>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-[13px] text-muted tabular-nums">
          {who ? who : "—"}{when ? " · " + when : ""}
        </p>
      </div>
    </li>
  );
}

/** Full order record: the lines as agreed, plus who touched it and when. */
export function OrderDetail({ order, data, t, lang, onClose, footer }) {
  if (!order) return null;
  const items = itemsOf(data, order.order_id);
  const products = productMap(data);
  const totals = orderTotals(data, order.order_id);
  const short = shortfalls(data, order.order_id);
  const shortIds = new Set(short.map((s) => s.product_id));
  const reached = { Pending: 1, Adjusted: 2, Dispatched: 3, Completed: 4, Cancelled: 1 }[order.status] || 1;

  return (
    <Modal
      open={Boolean(order)}
      onClose={onClose}
      size="lg"
      title={order.order_id}
      description={order.note || undefined}
      footer={footer}
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 flex-wrap">
          <StatusPill status={order.status} t={t} />
          <span className="text-sm text-muted tabular-nums">{formatWhen(order.date, lang)}</span>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">{t("order.lines")}</h3>
            <span className="text-[13px] text-muted tabular-nums">
              {t("misc.total")} {totals.approved} / {totals.requested}
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[12px] uppercase tracking-[0.06em] text-muted bg-surface2">
                  <th className="font-semibold px-4 py-2">{t("stock.product")}</th>
                  <th className="font-semibold px-4 py-2 text-right w-24">{t("order.requested")}</th>
                  <th className="font-semibold px-4 py-2 text-right w-24">{t("order.approved")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((item) => {
                  const product = products[item.product_id] || {};
                  const trimmed = Number(item.approved_qty) < Number(item.requested_qty);
                  return (
                    <tr key={item.product_id} className={cx(shortIds.has(item.product_id) && "bg-redTint")}>
                      <td className="px-4 py-2.5 text-ink">
                        {productName(product, lang)}
                        <span className="text-muted text-[12px] ml-2">{t("unit." + (product.unit || "pcs"))}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted">{item.requested_qty}</td>
                      <td className={cx("px-4 py-2.5 text-right font-mono tabular-nums font-semibold",
                        trimmed ? "text-steel" : "text-ink")}>
                        {item.approved_qty}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted mb-3">{t("order.timeline")}</h3>
          <ol>
            <TimelineStep done={reached >= 1} label={t("status.Pending")} who={order.created_by}
              when={formatWhen(order.date, lang)} />
            <TimelineStep done={reached >= 2} label={t("status.Adjusted")}
              who={order.adjusted_by || (reached >= 2 ? t("role.factory") : "")}
              when={order.adjusted_at ? formatWhen(order.adjusted_at, lang) : ""} />
            <TimelineStep done={reached >= 3} label={t("status.Dispatched")} who={order.dispatched_by}
              when={order.dispatched_at ? formatWhen(order.dispatched_at, lang) : ""} />
            <TimelineStep done={reached >= 4} label={t("status.Completed")} who={order.received_by}
              when={order.received_at ? formatWhen(order.received_at, lang) : ""} last />
          </ol>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Confirms cancelling an order and requires a reason — cancellation is
 * owner/manager-only and irreversible, so it gets its own step instead of a
 * bare confirm().
 */
export function CancelOrderModal({ open, order, t, onClose, onConfirm, busy }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) { setReason(""); setError(""); }
  }, [open]);

  if (!order) return null;

  const submit = async () => {
    const clean = reason.trim();
    if (!clean) { setError(t("order.cancelReasonRequired")); return; }
    try {
      await onConfirm(clean);
    } catch (e) {
      setError(t(e.code || "err.title", e.vars));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("order.cancelTitle")}
      description={t("order.cancelBody", { id: order.order_id })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("action.cancel")}</Button>
          <Button variant="danger" onClick={submit} loading={busy}>{t("action.cancelOrder")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("order.cancelReason")}>
          <textarea className={cx(inputCls, "min-h-20 py-2")} value={reason}
            onChange={(e) => setReason(e.target.value)} placeholder={t("order.cancelReasonPlaceholder")} />
        </Field>
        {error ? <InlineError>{error}</InlineError> : null}
      </div>
    </Modal>
  );
}
