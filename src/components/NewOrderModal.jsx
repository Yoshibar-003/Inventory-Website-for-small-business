import React, { useEffect, useMemo, useState } from "react";
import { Badge, Button, Icon, InlineError, Modal, Stepper, cx, inputCls } from "./ui.jsx";
import { categoryName, productName } from "../lib/i18n.js";
import { categoriesOf, lowStock, productVisible, stockOf } from "../hooks/useInventory.js";
import { CameraScanner } from "./CameraScanner.jsx";

/**
 * Step 1 of the workflow: the shop drafts an order.
 * Opening it with `prefillLow` seeds every low product with the quantity that would
 * bring it back to par, which is the request staff make ninety percent of the time.
 */
export function NewOrderModal({ open, onClose, data, t, lang, prefillLow, staff, onSubmit, busy }) {
  const [qty, setQty] = useState({});
  const [note, setNote] = useState("");
  const [who, setWho] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setNote("");
    setQuery("");
    setCategory("all");
    setWho((staff && staff[0]) || "");
    if (prefillLow) {
      const seed = {};
      lowStock(data, "shop").forEach((row) => {
        if (row.deficit > 0) seed[row.product.product_id] = row.deficit;
      });
      setQty(seed);
    } else {
      setQty({});
    }
  }, [open, prefillLow]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.products
      .filter((p) => p.active !== false && productVisible(data, "shop", p.product_id))
      .filter((p) => category === "all" || p.category === category)
      .filter((p) =>
        !q ||
        p.product_name.toLowerCase().includes(q) ||
        (p.product_name_th || "").toLowerCase().includes(q)
        || String(p.barcode || "").toLowerCase().includes(q)
      )
      .map((p) => {
        const have = stockOf(data, "shop", p.product_id);
        return {
          product: p,
          have,
          low: have <= p.reorder_point,
          suggested: Math.max(0, (p.par_level || 0) - have),
          value: qty[p.product_id] || 0,
        };
      })
      .sort((a, b) => Number(b.low) - Number(a.low) || a.have - b.have);
  }, [data, query, category, qty]);

  const totals = useMemo(() => {
    const entries = Object.entries(qty).filter(([, v]) => v > 0);
    return {
      lines: entries.length,
      units: entries.reduce((s, [, v]) => s + v, 0),
    };
  }, [qty]);

  const fillToPar = () => {
    const next = { ...qty };
    rows.forEach((row) => {
      if (row.suggested > 0) next[row.product.product_id] = row.suggested;
    });
    setQty(next);
  };

  const applyCode = (code) => {
    const normalized = String(code || "").trim().toLowerCase();
    if (!normalized) { setError(t("scan.notFound")); return; }
    const product = data.products.find((p) =>
      String(p.barcode || "").trim().toLowerCase() === normalized ||
      String(p.product_id || "").trim().toLowerCase() === normalized
    );
    if (!product) { setError(t("scan.notFound")); return; }
    setQty((current) => ({ ...current, [product.product_id]: Number(current[product.product_id] || 0) + 1 }));
    setError("");
    setCategory("all");
    setQuery(productName(product, lang));
  };
  const scan = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    applyCode(query.trim());
  };

  const submit = async () => {
    const items = Object.entries(qty)
      .filter(([, v]) => v > 0)
      .map(([product_id, requested_qty]) => ({ product_id, requested_qty }));
    if (!items.length) {
      setError(t("err.emptyOrder"));
      return;
    }
    try {
      await onSubmit({ items, note, created_by: who.trim() || "Shop" });
      onClose();
    } catch (e) {
      setError(t(e.code || "err.title", e.vars));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t("order.new")}
      description={t("low.body")}
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <p className="text-sm text-muted tabular-nums">
            {t("order.items", { n: totals.lines })}
            <span className="mx-2" aria-hidden="true">·</span>
            {t("order.units", { n: totals.units })}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>{t("action.cancel")}</Button>
            <Button variant="primary" icon="arrow" onClick={submit} loading={busy} disabled={totals.lines === 0}>
              {t("action.submit")}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative grow min-w-[200px]">
            <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className={cx(inputCls, "pl-9 pr-20")} placeholder={t("scan.placeholder")} value={query}
              onChange={(e) => setQuery(e.target.value)} onKeyDown={scan} />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
              {query ? <button type="button" aria-label={t("action.clear")} title={t("action.clear")}
                onClick={() => { setQuery(""); setError(""); }}
                className="grid place-items-center w-8 h-8 rounded-md text-muted hover:text-ink hover:bg-surface2 focus-ring">
                <Icon name="x" className="w-4 h-4" />
              </button> : null}
              <button type="button" aria-label={t("scan.cameraButton")} title={t("scan.cameraButton")}
                onClick={() => setCameraOpen(true)}
                className="grid place-items-center w-8 h-8 rounded-md text-muted hover:text-brandStrong hover:bg-brandTint focus-ring">
                <Icon name="camera" className="w-4 h-4" />
              </button>
            </div>
          </div>
          <select className={cx(inputCls, "w-auto min-w-[150px]")} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">{t("misc.all")} — {t("product.category")}</option>
            {categoriesOf(data).map((c) => <option key={c} value={c}>{categoryName(t, c)}</option>)}
          </select>
          <Button size="md" icon="refresh" onClick={fillToPar}>{t("action.fillToPar")}</Button>
          <Button size="md" variant="ghost" onClick={() => setQty({})}>{t("action.clear")}</Button>
        </div>

        <ul className="rounded-xl border border-line divide-y divide-line overflow-hidden">
          {rows.map(({ product, have, low, suggested, value }) => (
            <li key={product.product_id}
              className={cx("flex items-center gap-3 px-4 py-2.5", value > 0 && "bg-brandTint/40")}>
              <div className="grow min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink truncate">{productName(product, lang)}</span>
                  {low ? <Badge tone="amber">{t("stock.lowBadge")}</Badge> : null}
                </div>
                <p className="text-[12px] text-muted mt-0.5">
                  {t("stock.title")}: <span className="font-mono tabular-nums">{have}</span>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  {t("stock.par")} <span className="font-mono tabular-nums">{product.par_level}</span>
                </p>
              </div>
              {suggested > 0 && value !== suggested ? (
                <button type="button"
                  onClick={() => setQty((q) => ({ ...q, [product.product_id]: suggested }))}
                  className="text-[12px] font-medium text-brandStrong hover:underline focus-ring rounded px-1 hidden sm:block">
                  +{suggested}
                </button>
              ) : null}
              <Stepper size="sm" value={value} label={productName(product, lang)}
                onChange={(v) => setQty((q) => ({ ...q, [product.product_id]: v }))} />
            </li>
          ))}
        </ul>

        <div className="grid sm:grid-cols-[1fr_200px] gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-muted">{t("order.note")}</span>
            <input className={inputCls} value={note} placeholder={t("order.notePlaceholder")}
              onChange={(e) => setNote(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-muted">{t("order.createdBy")}</span>
            <input className={inputCls} value={who} placeholder={t("stamp.placeholder")}
              onChange={(e) => setWho(e.target.value)} />
          </label>
        </div>

        {error ? <InlineError>{error}</InlineError> : null}
      </div>
      <CameraScanner open={cameraOpen} onClose={() => setCameraOpen(false)} onScan={applyCode} t={t} />
    </Modal>
  );
}
