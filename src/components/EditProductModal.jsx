import React, { useEffect, useState } from "react";
import { Button, Field, InlineError, Modal, cx, inputCls } from "./ui.jsx";
import { productName } from "../lib/i18n.js";

/**
 * Dedicated edit surface for a single product's identity and reorder settings.
 * Kept separate from the row-level quantity editor: renaming a product_id
 * touches every table that references it, so it gets its own confirmation
 * step instead of living inline in the stock list.
 */
export function EditProductModal({ open, product, t, lang, onClose, onSave, busy }) {
  const [productId, setProductId] = useState("");
  const [reorderPoint, setReorderPoint] = useState("");
  const [parLevel, setParLevel] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!product) return;
    setProductId(product.product_id);
    setReorderPoint(String(product.reorder_point));
    setParLevel(String(product.par_level));
    setReason("");
    setError("");
  }, [product && product.product_id]);

  if (!product) return null;

  const submit = async () => {
    const nextId = productId.trim();
    const reorder = Number(reorderPoint);
    const par = Number(parLevel);
    const cleanReason = reason.trim();
    if (!nextId) { setError(t("product.idRequired")); return; }
    if (!/^[A-Za-z0-9_-]+$/.test(nextId)) { setError(t("product.idInvalid")); return; }
    if (!Number.isFinite(reorder) || reorder < 0 || !Number.isFinite(par) || par < 0) {
      setError(t("err.negative"));
      return;
    }
    if (!cleanReason) { setError(t("product.editReasonRequired")); return; }
    try {
      await onSave({
        product_id: product.product_id,
        new_product_id: nextId !== product.product_id ? nextId : undefined,
        reorder_point: Math.trunc(reorder),
        par_level: Math.trunc(par),
        reason: cleanReason,
      });
      onClose();
    } catch (e) {
      setError(t(e.code || "err.title", e.vars));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("product.editTitle")}
      description={productName(product, lang)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("action.cancel")}</Button>
          <Button variant="primary" icon="check" onClick={submit} loading={busy}>{t("action.save")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("product.id")} hint={t("product.idHint")}>
          <input className={inputCls} value={productId} onChange={(e) => setProductId(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("product.reorderPoint")}>
            <input type="number" min="0" className={inputCls} value={reorderPoint}
              onChange={(e) => setReorderPoint(e.target.value)} />
          </Field>
          <Field label={t("product.parLevel")}>
            <input type="number" min="0" className={inputCls} value={parLevel}
              onChange={(e) => setParLevel(e.target.value)} />
          </Field>
        </div>
        <Field label={t("product.editReason")} hint={t("product.editReasonHint")}>
          <textarea className={cx(inputCls, "min-h-20 py-2")} value={reason}
            onChange={(e) => setReason(e.target.value)} placeholder={t("product.editReasonPlaceholder")} />
        </Field>
        {error ? <InlineError>{error}</InlineError> : null}
      </div>
    </Modal>
  );
}
