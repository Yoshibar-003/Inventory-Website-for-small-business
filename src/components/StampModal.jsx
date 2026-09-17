import React, { useEffect, useState } from "react";
import { Badge, Button, Field, InlineError, Modal, inputCls, cx } from "./ui.jsx";
import { productName } from "../lib/i18n.js";
import { itemsOf, productMap, shortfalls, stockOf } from "../hooks/useInventory.js";

/**
 * The dispatch and receipt stamps. One component, two modes — the physical act is the
 * same both ends of the van: check the goods against the list, then sign for them.
 */
export function StampModal({ open, onClose, mode, order, data, t, lang, staff, onConfirm, busy }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setError("");
    }
  }, [open, order && order.order_id]);

  if (!order) return null;

  const isDispatch = mode === "dispatch";
  const items = itemsOf(data, order.order_id).filter((i) => Number(i.approved_qty) > 0);
  const products = productMap(data);
  const short = isDispatch ? shortfalls(data, order.order_id) : [];
  const blocked = short.length > 0;

  const submit = async () => {
    const clean = name.trim();
    if (!clean) {
      setError(t("stamp.required"));
      return;
    }
    try {
      await onConfirm(clean);
      onClose();
    } catch (e) {
      setError(t(e.code || "err.title", e.vars));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t(isDispatch ? "stamp.dispatchTitle" : "stamp.receiveTitle")}
      description={t(isDispatch ? "stamp.dispatchBody" : "stamp.receiveBody")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("action.cancel")}</Button>
          <Button
            variant={isDispatch ? "primary" : "go"}
            icon={isDispatch ? "truck" : "check"}
            onClick={submit}
            loading={busy}
            disabled={blocked}
          >
            {t(isDispatch ? "action.dispatch" : "action.receive")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono font-medium text-ink">{order.order_id}</span>
          <span className="text-muted">·</span>
          <span className="text-muted">{t("order.items", { n: items.length })}</span>
        </div>

        {blocked ? (
          <InlineError>
            {t("err.insufficient", {
              name: productName(products[short[0].product_id], lang),
              have: short[0].have,
              want: short[0].approved_qty,
              unit: t("unit." + (products[short[0].product_id] || { unit: "pcs" }).unit),
            })}
          </InlineError>
        ) : null}

        <div>
          <p className="text-[13px] text-muted mb-2">{t("stamp.checklist")}</p>
          <ul className="rounded-xl border border-line divide-y divide-line overflow-hidden">
            {items.map((item) => {
              const product = products[item.product_id] || {};
              const have = stockOf(data, "factory", item.product_id);
              const isShort = isDispatch && item.approved_qty > have;
              return (
                <li key={item.product_id} className={cx("flex items-center gap-3 px-4 py-2.5", isShort && "bg-redTint")}>
                  <span className="grow text-sm text-ink">{productName(product, lang)}</span>
                  {isShort ? <Badge tone="red">{t("order.shortfall", { n: item.approved_qty - have })}</Badge> : null}
                  <span className="font-mono tabular-nums text-sm font-semibold text-ink">
                    {item.approved_qty}
                  </span>
                  <span className="text-[13px] text-muted w-10">{t("unit." + (product.unit || "pcs"))}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <Field label={t("stamp.name")}>
          <input
            className={inputCls}
            value={name}
            placeholder={t("stamp.placeholder")}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          />
        </Field>

        {staff && staff.length ? (
          <div className="flex items-center gap-2 flex-wrap -mt-2">
            <span className="text-[12px] text-muted">{t("stamp.recent")}</span>
            {staff.slice(0, 5).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setName(s); setError(""); }}
                className={cx(
                  "rounded-full border px-3 h-7 text-[13px] transition-colors focus-ring",
                  name === s ? "border-brand bg-brandTint text-brandStrong font-medium" : "border-line2 text-muted hover:text-ink hover:border-ink"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {error ? <InlineError>{error}</InlineError> : null}
      </div>
    </Modal>
  );
}
