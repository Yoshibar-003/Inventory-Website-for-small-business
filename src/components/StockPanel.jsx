import React, { useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Icon, InlineError, Modal, SectionHead, Stepper, cx, inputCls } from "./ui.jsx";
import { categoryName, productName } from "../lib/i18n.js";
import { categoriesOf, productVisible, stockOf } from "../hooks/useInventory.js";
import { UNITS } from "../lib/mockDb.js";
import { CategoryManager } from "./CategoryManager.jsx";
import { CameraScanner } from "./CameraScanner.jsx";
import { EditProductModal } from "./EditProductModal.jsx";
import { buildDailySalesReportRows } from "../lib/salesReportCsv.js";
import { downloadBase64Xlsx, downloadSheet } from "../lib/xlsxExport.js";

/**
 * Stock on hand for one location, with manual adjustment.
 * Edits are staged locally and committed per row, so a mis-tap on a stepper
 * never writes to the sheet on its own. Product identity (ID, reorder point,
 * par level) is edited separately through EditProductModal — a rename
 * cascades across every table that references the product, so it gets its
 * own confirmation step instead of living inline in the stock list.
 */
export function StockPanel({ data, location, t, lang, onSave, onSaved, onAddProduct, onArchiveProduct, onSetLocationActive, onSaveAll, onExportMonthly, onEditProduct, busy, editable = true, showBoth = false, includeFactoryOnly = true, canRequestRemoval = false, stockRequests = [], stockBatches = [], onRequestRemoval, onDecideStockRemoval, categoryActions }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [adding, setAdding] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);
  const [moveCategory, setMoveCategory] = useState({});
  const [scanError, setScanError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [exportStart, setExportStart] = useState(() => new Date().toISOString().slice(0, 7) + "-01");
  const [exportEnd, setExportEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [exportError, setExportError] = useState("");
  const invalidExportRange = !exportStart || !exportEnd || exportStart > exportEnd;
  const [exporting, setExporting] = useState(false);
  const [draft, setDraft] = useState({});
  const [reasonDraft, setReasonDraft] = useState({});
  const [editing, setEditing] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [page, setPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [saveError, setSaveError] = useState("" );
  const [reportOpen, setReportOpen] = useState(false);
  const [reportQty, setReportQty] = useState({});
  const [reportNote, setReportNote] = useState("");
  const [removeError, setRemoveError] = useState("");
  const pendingBatches = stockBatches.filter((batch) => batch.location === location && batch.status === "Pending");
  // Decided reports stay visible (and downloadable) instead of disappearing
  // once approved or denied, so a day's sales history is never just gone.
  const decidedBatches = [...stockBatches]
    .filter((batch) => batch.location === location && batch.status !== "Pending")
    .sort((a, b) => new Date(b.requested_at || 0) - new Date(a.requested_at || 0));
  const HISTORY_PAGE_SIZE = 3;
  const historyPageCount = Math.max(1, Math.ceil(decidedBatches.length / HISTORY_PAGE_SIZE));
  const currentHistoryPage = Math.min(historyPage, historyPageCount);
  const historyPageBatches = decidedBatches.slice(
    (currentHistoryPage - 1) * HISTORY_PAGE_SIZE, currentHistoryPage * HISTORY_PAGE_SIZE
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.products
      .filter((p) => p.active !== false && (showBoth && includeFactoryOnly
        ? productVisible(data, "shop", p.product_id) || productVisible(data, "factory", p.product_id)
        : productVisible(data, location, p.product_id)))
      .filter((p) => category === "all" || p.category === category)
      .filter((p) =>
        !q ||
        p.product_name.toLowerCase().includes(q) ||
        (p.product_name_th || "").toLowerCase().includes(q) ||
        p.product_id.toLowerCase().includes(q)
        || String(p.barcode || "").toLowerCase().includes(q)
      )
      .map((p) => ({ product: p, saved: stockOf(data, location, p.product_id) }));
  }, [data, location, showBoth, includeFactoryOnly, query, category]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 10));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * 10, currentPage * 10);
  const editingProduct = editingProductId ? data.products.find((p) => p.product_id === editingProductId) : null;


  const applyCode = (code) => {
    const normalized = String(code || "").trim().toLowerCase();
    if (!normalized) { setScanError(t("scan.notFound")); return; }
    const product = data.products.find((p) =>
      String(p.barcode || "").trim().toLowerCase() === normalized ||
      String(p.product_id || "").trim().toLowerCase() === normalized
    );
    if (!product) { setScanError(t("scan.notFound")); return; }
    setCategory("all");
    setQuery(code);
    setPage(1);
    setScanError("");

  };
  const saveRow = async (product, saved) => {
    try {
      const quantity = Number(draft[product.product_id] ?? saved);
      const reason = String(reasonDraft[product.product_id] || "").trim();
      if (quantity !== saved) await onSave(product.product_id, quantity, reason);
      setDraft((current) => {
        const next = { ...current };
        delete next[product.product_id];
        return next;
      });
      setReasonDraft((current) => {
        const next = { ...current };
        delete next[product.product_id];
        return next;
      });
      setSaveError("");
      onSaved();
    } catch (error) {
      setSaveError(t(error.code || "err.title", error.vars));
    }
  };
  const scan = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    applyCode(query.trim());
  };

  const exportCsv = async () => {
    if (invalidExportRange) { setExportError(t("err.exportRange")); return; }
    setExportError("");
    setExporting(true);
    try {
      const result = await onExportMonthly({ start_date: exportStart, end_date: exportEnd, lang });
      downloadBase64Xlsx(result.filename, result.base64);
    } catch (error) { setExportError(t(error.code || "err.network")); } finally { setExporting(false); }
  };
  const archive = async (product) => {
    const name = productName(product, lang);
    if (!window.confirm(t("product.deleteConfirm", { name }))) return;
    await onSetLocationActive({ location, product_id: product.product_id, active: false });

  };

  return (
    <section className="flex flex-col gap-4">
      {editable ? <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="flex flex-col items-start gap-1 text-sm"><span>{t("stock.exportFrom")}</span><input type="date" className={cx(inputCls, "w-full")} value={exportStart} max={exportEnd || undefined} onChange={(event) => { setExportStart(event.target.value); setExportError(""); }} /></label>
        <label className="flex flex-col items-start gap-1 text-sm"><span>{t("stock.exportTo")}</span><input type="date" className={cx(inputCls, "w-full")} value={exportEnd} min={exportStart || undefined} onChange={(event) => { setExportEnd(event.target.value); setExportError(""); }} /></label>
        <Button className="w-full sm:w-auto" icon="list" onClick={exportCsv} loading={exporting} disabled={invalidExportRange}>{t("stock.exportCsv")}</Button>
        <div className="sm:col-start-3 flex justify-end">
          <Button className="w-full sm:w-auto" variant={editing ? "ghost" : "primary"} onClick={() => { setEditing((value) => !value); setDraft({}); setReasonDraft({}); setSaveError(""); }}>{t(editing ? "action.finishEditing" : "action.edit")}</Button>
        </div>
      </div> : null}
      {exportError || invalidExportRange ? <InlineError>{exportError || t("err.exportRange")}</InlineError> : null}
      <SectionHead
        title={t("stock.title")}
        count={rows.length}
        description={showBoth ? t("stock.bothLocations") : location === "factory" ? t("role.factory") : t("role.shop")}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                className={cx(inputCls, "pl-9 pr-20 w-64")}
                placeholder={t("scan.placeholder")}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); setScanError(""); }}
                onKeyDown={scan}
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                {query ? <button type="button" aria-label={t("action.clear")} title={t("action.clear")}
                  onClick={() => { setQuery(""); setScanError(""); }}
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
            <select className={cx(inputCls, "w-auto min-w-[150px]")} value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
              <option value="all">{t("misc.all")} — {t("product.category")}</option>
              {categoriesOf(data).map((c) => <option key={c} value={c}>{categoryName(t, c)}</option>)}
            </select>
            {editable && location === "factory" ? <><Button variant="ghost" onClick={() => setManagingCategories(true)}>{t("category.manage")}</Button><Button icon="plus" onClick={() => setAdding(true)}>{t("action.addProduct")}</Button></> : null}
          </div>
        }
      />

      {scanError ? <InlineError>{scanError}</InlineError> : null}
      {saveError ? <InlineError>{saveError}</InlineError> : null}
      {canRequestRemoval ? <Button onClick={() => { setReportQty({}); setReportNote(""); setRemoveError(""); setReportOpen(true); }}>{t("stock.openDailyReport")}</Button> : null}

      {editable && pendingBatches.length ? (
        <Card className="p-4 sm:p-5 border-amber/30">
          <h3 className="font-semibold text-ink">{t("stock.pendingReports")} ({pendingBatches.length})</h3>
          <div className="mt-3 divide-y divide-line">
            {pendingBatches.map((batch) => {
              const items = stockRequests.filter((request) => request.batch_id === batch.batch_id);
              return <div key={batch.batch_id} className="py-3 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="grow min-w-0">
                    <p className="font-medium">{t("stock.dailyReport")} · {batch.business_date}</p>
                    <p className="text-sm text-muted">{t("stock.requestedBy")}: {batch.requested_by}{batch.note ? ` · ${batch.note}` : ""}</p>
                  </div>
                  <div className="flex gap-2 self-end sm:self-auto">
                    {location === "shop" ? <Button size="sm" variant="ghost" icon="list"
                      onClick={() => { const report = buildDailySalesReportRows(batch, items, data, t, lang); downloadSheet(report.filename, report.rows, { lang }); }}>
                      {t("action.downloadCsv")}
                    </Button> : null}
                    <Button size="sm" variant="danger" onClick={() => onDecideStockRemoval({ batch_id: batch.batch_id, approve: false })} loading={busy === "decideDailyStockReport:" + batch.batch_id}>{t("stock.denyRemoval")}</Button>
                    <Button size="sm" variant="go" icon="check" onClick={() => onDecideStockRemoval({ batch_id: batch.batch_id, approve: true })} loading={busy === "decideDailyStockReport:" + batch.batch_id}>{t("stock.approveRemoval")}</Button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-x-5 gap-y-1 text-sm">
                  {items.map((item) => { const product = data.products.find((p) => p.product_id === item.product_id); return <div key={item.request_id} className="flex justify-between gap-3"><span className="truncate">{productName(product, lang) || item.product_id}</span><strong className="font-mono">{item.quantity}</strong></div>; })}
                </div>
              </div>;
            })}
          </div>
        </Card>
      ) : null}

      {editable && location === "shop" && decidedBatches.length ? (
        <Card className="p-4 sm:p-5">
          <h3 className="font-semibold text-ink">{t("stock.reportHistory")} ({decidedBatches.length})</h3>
          <div className="mt-3 divide-y divide-line">
            {historyPageBatches.map((batch) => {
              const items = stockRequests.filter((request) => request.batch_id === batch.batch_id);
              return <div key={batch.batch_id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="grow min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{t("stock.dailyReport")} · {batch.business_date}</p>
                    <Badge tone={batch.status === "Approved" ? "green" : "red"}>{t("status." + batch.status)}</Badge>
                  </div>
                  <p className="text-sm text-muted">
                    {t("stock.requestedBy")}: {batch.requested_by}
                    {batch.decided_by ? ` · ${t("stock.decidedBy")}: ${batch.decided_by}` : ""}
                    {batch.note ? ` · ${batch.note}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="ghost" icon="list"
                  onClick={() => { const report = buildDailySalesReportRows(batch, items, data, t, lang); downloadSheet(report.filename, report.rows, { lang }); }}>
                  {t("action.downloadCsv")}
                </Button>
              </div>;
            })}
          </div>
          {decidedBatches.length > HISTORY_PAGE_SIZE ? <div className="flex items-center justify-center gap-3 mt-3">
            <Button size="sm" variant="ghost" disabled={currentHistoryPage === 1} onClick={() => setHistoryPage(currentHistoryPage - 1)}>{t("action.previous")}</Button>
            <span className="text-sm text-muted tabular-nums">{t("stock.page", { page: currentHistoryPage, pages: historyPageCount })}</span>
            <Button size="sm" variant="ghost" disabled={currentHistoryPage === historyPageCount} onClick={() => setHistoryPage(currentHistoryPage + 1)}>{t("action.next")}</Button>
          </div> : null}
        </Card>
      ) : null}
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon="search" title={t("stock.noResults")} />
        ) : (
          <ul className="divide-y divide-line">
            {pageRows.map(({ product, saved }) => {
              const out = saved === 0;
              const low = !out && saved <= product.reorder_point;
              const dirty = draft[product.product_id] !== undefined && Number(draft[product.product_id]) !== saved;
              return (
                <li key={product.product_id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3">
                  <div className="grow min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-ink truncate">{productName(product, lang)}</span>
                      {out ? <Badge tone="red">{t("stock.outBadge")}</Badge>
                        : low ? <Badge tone="amber">{t("stock.lowBadge")}</Badge> : <Badge tone="green">{t("stock.inStock")}</Badge>}
                    </div>
                    <p className="text-[13px] text-muted mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="font-mono">{product.product_id}</span>
                      <span aria-hidden="true">·</span>
                      <span>{categoryName(t, product.category)}</span>
                      {product.barcode ? <><span aria-hidden="true">·</span><span className="font-mono">{product.barcode}</span></> : null}
                      <span aria-hidden="true">·</span>
                      <span>{t("stock.reorder")} {product.reorder_point} {t("unit." + product.unit)}</span>
                    </p>
                    {editable && editing && dirty ? <label className="block mt-3 max-w-sm text-xs text-muted">
                      {t("stock.adjustReason")}
                      <input className={cx(inputCls, "mt-1")} value={reasonDraft[product.product_id] || ""}
                        onChange={(event) => setReasonDraft((current) => ({ ...current, [product.product_id]: event.target.value }))}
                        placeholder={t("stock.adjustReasonPlaceholder")} />
                    </label> : null}
                  </div>

                  {showBoth ? <div className="grid grid-cols-2 gap-2 shrink-0 self-stretch sm:self-auto">
                    {["shop", "factory"].map((stockLocation) => {
                      const quantity = stockOf(data, stockLocation, product.product_id);
                      const canEditThis = editable && editing && stockLocation === location;
                      return <div key={stockLocation} className="min-w-[7rem] rounded-lg bg-surface2 px-3 py-2 text-center">
                        <p className="text-[11px] uppercase tracking-[0.05em] text-muted">{t(stockLocation === "shop" ? "stock.shopStock" : "stock.factoryStock")}</p>
                        {canEditThis ? <div className="mt-1"><Stepper size="sm" value={Number(draft[product.product_id] ?? saved)} min={0} max={999999} onChange={(value) => setDraft((current) => ({ ...current, [product.product_id]: value }))} label={productName(product, lang)} /></div>
                          : <p className="font-mono tabular-nums font-semibold text-ink mt-1">{quantity}</p>}
                      </div>;
                    })}
                  </div> : <div className="shrink-0 self-end sm:self-auto">{editable && editing ? <Stepper size="sm" value={Number(draft[product.product_id] ?? saved)} min={0} max={999999} onChange={(quantity) => setDraft((current) => ({ ...current, [product.product_id]: quantity }))} label={productName(product, lang)} /> : <span className="font-mono tabular-nums font-semibold">{saved}</span>}</div>}

                  {editable ? <>
                    {editing ? <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditingProductId(product.product_id)}>
                      {t("action.editProduct")}
                    </Button> : null}
                    {editing && location === "factory" && categoryActions ? <div className="flex w-full sm:w-auto items-center gap-2"><select className={cx(inputCls, "min-w-0 grow sm:w-auto sm:min-w-[130px]")} value={moveCategory[product.product_id] ?? product.category} onChange={(event) => setMoveCategory((current) => ({ ...current, [product.product_id]: event.target.value }))}>{categoriesOf(data).map((name) => <option key={name} value={name}>{categoryName(t, name)}</option>)}</select><Button size="sm" variant="ghost" disabled={(moveCategory[product.product_id] ?? product.category) === product.category} loading={busy === "setProductCategory:" + product.product_id} onClick={() => categoryActions.setProductCategory({ product_id: product.product_id, category: moveCategory[product.product_id] })}>{t("category.moveProduct")}</Button></div> : null}
                    {location === "factory" && !productVisible(data, "shop", product.product_id) ? <Button size="sm" variant="go" onClick={() => onSetLocationActive({ location: "shop", product_id: product.product_id, active: true })} loading={busy === "setProductLocationActive:shop:" + product.product_id}>{t("stock.publishShop")}</Button> : null}
                    {editing ? <Button size="sm" variant="primary" icon="check" disabled={
                      !dirty || !String(reasonDraft[product.product_id] || "").trim()
                    } onClick={() => saveRow(product, saved)} loading={busy === "setStock:" + location + ":" + product.product_id}>{t("action.save")}</Button> : null}
                  </> : null}

                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {rows.length > 10 ? <div className="flex items-center justify-center gap-3">
        <Button size="sm" variant="ghost" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>{t("action.previous")}</Button>
        <span className="text-sm text-muted tabular-nums">{t("stock.page", { page: currentPage, pages: pageCount })}</span>
        <Button size="sm" variant="ghost" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>{t("action.next")}</Button>
      </div> : null}


      {editable && location === "factory" ? <><AddProductModal open={adding} onClose={() => setAdding(false)} t={t} categories={categoriesOf(data)} onAdd={onAddProduct} busy={busy === "addProduct"} /><CategoryManager open={managingCategories} onClose={() => setManagingCategories(false)} t={t} categories={categoriesOf(data)} actions={categoryActions} busy={busy} /></> : null}
      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title={t("stock.dailyReportTitle")}
        description={t("stock.dailyReportBody")}
        footer={<><Button variant="ghost" onClick={() => setReportOpen(false)}>{t("action.cancel")}</Button><Button variant="primary" loading={busy === "requestDailyStockReport"} onClick={async () => {
          const items = data.products.filter((product) => product.active !== false && productVisible(data, location, product.product_id)).map((product) => ({ product_id: product.product_id, quantity: Number(reportQty[product.product_id] || 0) })).filter((item) => item.quantity > 0);
          if (!items.length) { setRemoveError(t("err.emptyReport")); return; }
          if (items.some((item) => item.quantity > stockOf(data, location, item.product_id))) { setRemoveError(t("err.insufficientStock")); return; }
          try { await onRequestRemoval({ location, business_date: new Date().toISOString().slice(0, 10), note: reportNote, items }); setReportOpen(false); }
          catch (error) { setRemoveError(t(error.code || "err.title", error.vars)); }
        }}>{t("stock.sendReport")}</Button></>}>
        <div className="flex flex-col gap-4">
          <div className="divide-y divide-line border border-line rounded-xl overflow-hidden">
            {data.products.filter((product) => product.active !== false && productVisible(data, location, product.product_id)).map((product) => { const available = stockOf(data, location, product.product_id); return <div key={product.product_id} className="flex items-center gap-3 p-3">
              <div className="grow min-w-0"><p className="font-medium truncate">{productName(product, lang)}</p><p className="text-xs text-muted">{t("stock.qty")}: {available}</p></div>
              <Stepper size="sm" value={Number(reportQty[product.product_id] || 0)} min={0} max={available} onChange={(quantity) => setReportQty((current) => ({ ...current, [product.product_id]: quantity }))} label={productName(product, lang)} />
            </div>; })}
          </div>
          <Field label={t("stock.note")}><textarea className={cx(inputCls, "min-h-20 py-2")} value={reportNote} onChange={(event) => setReportNote(event.target.value)} placeholder={t("stock.notePlaceholder")} /></Field>
          {removeError ? <InlineError>{removeError}</InlineError> : null}
        </div>
      </Modal>
      <CameraScanner open={cameraOpen} onClose={() => setCameraOpen(false)} onScan={applyCode} t={t} />
      <EditProductModal
        open={Boolean(editingProduct)}
        product={editingProduct}
        t={t}
        lang={lang}
        busy={Boolean(editingProduct) && busy === "editProduct:" + editingProduct.product_id}
        onClose={() => setEditingProductId(null)}
        onSave={onEditProduct}
      />
    </section>
  );
}

export function AddProductModal({ open, onClose, onAdd, t, busy, categories }) {
  const blank = { product_name: "", product_name_th: "", barcode: "", category: categories[0] || "Other", unit: "pcs", reorder_point: 24, par_level: 96, publish_to_shop: false };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    if (!form.product_name.trim() && !form.product_name_th.trim()) {
      setError(t("product.nameRequired"));
      return;
    }
    try {
      await onAdd(form);
      setForm(blank);
      setError("");
      onClose();
    } catch (e) {
      setError(t(e.code || "err.title", e.vars));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("product.addTitle")}
      description={t("product.addBody")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("action.cancel")}</Button>
          <Button variant="primary" icon="plus" onClick={submit} loading={busy}>{t("action.add")}</Button>
        </>
      }
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label={t("product.name")}>
          <input className={inputCls} value={form.product_name} onChange={set("product_name")} placeholder="Coconut Milk Bar" />
        </Field>
        <Field label={t("product.nameTh")}>
          <input className={inputCls} value={form.product_name_th} onChange={set("product_name_th")} placeholder="ไอศกรีมกะทิแท่ง" />
        </Field>
        <Field label={t("product.barcode")}>
          <input className={inputCls} value={form.barcode} onChange={set("barcode")} placeholder="8851234567890" />
        </Field>
        <Field label={t("product.category")}>
          <select className={inputCls} value={form.category} onChange={set("category")}>
            {categories.map((c) => <option key={c} value={c}>{categoryName(t, c)}</option>)}
          </select>
        </Field>
        <Field label={t("product.unit")}>
          <select className={inputCls} value={form.unit} onChange={set("unit")}>
            {UNITS.map((u) => <option key={u} value={u}>{t("unit." + u)}</option>)}
          </select>
        </Field>
        <Field label={t("product.reorderPoint")} hint={t("low.body")}>
          <input className={inputCls} inputMode="numeric" value={form.reorder_point} onChange={set("reorder_point")} />
        </Field>
        <Field label={t("product.parLevel")}>
          <input className={inputCls} inputMode="numeric" value={form.par_level} onChange={set("par_level")} />
        </Field>
        <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-line bg-surface2 p-4 cursor-pointer">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-brand" checked={form.publish_to_shop}
            onChange={(event) => setForm((current) => ({ ...current, publish_to_shop: event.target.checked }))} />
          <span><span className="block text-sm font-medium text-ink">{t("stock.publishNewShop")}</span><span className="block text-xs text-muted mt-1">{t("stock.publishNewShopHint")}</span></span>
        </label>
      </div>
      {error ? <p className="text-sm text-red mt-4">{error}</p> : null}
    </Modal>
  );
}
