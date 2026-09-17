import React, { useMemo, useState } from "react";
import { Button, Card, EmptyState, Icon, SectionHead, Segmented, StatTile } from "./ui.jsx";
import { CancelOrderModal, OrderCard, OrderDetail } from "./orders.jsx";
import { NewOrderModal } from "./NewOrderModal.jsx";
import { StampModal } from "./StampModal.jsx";
import { StockPanel } from "./StockPanel.jsx";
import { productName } from "../lib/i18n.js";
import { itemsOf, lowStock, ordersByStatus } from "../hooks/useInventory.js";
import { openOrderReceipt } from "../lib/receipt.js";
import { buildOrderRows } from "../lib/orderCsv.js";
import { downloadSheet } from "../lib/xlsxExport.js";
import { CategorySummary } from "./CategorySummary.jsx";

// isOwner is true for the owner AND for the manager role — both get direct
// stock editing and can skip the removal-request flow; only staff/PIN
// management (gated separately, in App.jsx) stays owner-only.
export function ShopDashboard({ data, t, lang, busy, actions, pushToast, isOwner = false }) {
  const [tab, setTab] = useState("overview");
  const [ordering, setOrdering] = useState(null); // null | { prefillLow: boolean }
  const [detail, setDetail] = useState(null);
  const [receiving, setReceiving] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  const low = useMemo(() => lowStock(data, "shop"), [data]);
  const incoming = useMemo(() => ordersByStatus(data, ["Dispatched"]), [data]);
  const openOrders = useMemo(() => ordersByStatus(data, ["Pending", "Adjusted"]), [data]);
  const history = useMemo(() => ordersByStatus(data, ["Completed", "Cancelled", "Denied"]), [data]);

  const detailOrder = detail ? data.orders.find((o) => o.order_id === detail) : null;
  const receivingOrder = receiving ? data.orders.find((o) => o.order_id === receiving) : null;
  const cancellingOrder = cancelling ? data.orders.find((o) => o.order_id === cancelling) : null;

  const createOrder = async (payload) => {
    const snap = await actions.createOrder(payload);
    pushToast(t("toast.orderSent", { id: snap.order_id || "" }));
  };

  const receive = async (name) => {
    await actions.receiveOrder({ order_id: receiving, received_by: name });
    pushToast(t("toast.received", { id: receiving }));
    setReceiving(null);
  };

  const cancel = async (reason) => {
    await actions.cancelOrder({ order_id: cancelling, reason });
    pushToast(t("toast.cancelled", { id: cancelling }));
    setCancelling(null);
    setDetail(null);
  };

  const cancelButton = (order) => (
    <Button size="sm" variant="secondary" onClick={() => setCancelling(order.order_id)}>
      {t("action.cancelOrder")}
    </Button>
  );

  const receiveButton = (order) => (
    <Button size="sm" variant="go" icon="check" onClick={() => setReceiving(order.order_id)}>
      {t("action.receive")}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: t("tab.overview"), icon: "store" },
          { value: "orders", label: t("tab.orders"), icon: "list" },
          { value: "stock", label: t("tab.stock"), icon: "box" },
        ]}
      />

      {tab === "overview" ? (
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label={t("stat.lowItems")} value={low.length} tone={low.length ? "alert" : "neutral"}
              onClick={() => setTab("stock")} />
            <StatTile label={t("stat.awaitingReceipt")} value={incoming.length}
              tone={incoming.length ? "go" : "neutral"} onClick={() => setTab("orders")} />
            <StatTile label={t("stat.openOrders")} value={openOrders.length} onClick={() => setTab("orders")} />
            <StatTile label={t("stat.skuCount")} value={data.products.filter((p) => p.active !== false).length} />
          </div>

          <CategorySummary data={data} location="shop" t={t} />

          {low.length > 0 ? (
            <Card className="p-5 border-brand/35 bg-brandTint/50">
              <div className="flex items-start gap-4 flex-wrap">
                <span className="grid place-items-center w-9 h-9 rounded-lg bg-brand text-onBrand shrink-0">
                  <Icon name="snow" className="w-4.5 h-4.5" />
                </span>
                <div className="grow min-w-[220px]">
                  <h2 className="font-display font-semibold text-ink tracking-tight">
                    {low.length === 1 ? t("low.titleOne") : t("low.title", { n: low.length })}
                  </h2>
                  <p className="text-sm text-muted mt-0.5">{t("low.body")}</p>
                  <ul className="flex flex-wrap gap-1.5 mt-3">
                    {low.slice(0, 6).map((row) => (
                      <li key={row.product.product_id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-surface px-2.5 h-7 text-[13px]">
                        <span className="text-ink">{productName(row.product, lang)}</span>
                        <span className="font-mono tabular-nums text-brandStrong font-semibold">{row.qty}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button variant="primary" icon="plus" onClick={() => setOrdering({ prefillLow: true })}>
                  {t("low.cta")}
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-5 flex items-center gap-3">
              <span className="grid place-items-center w-9 h-9 rounded-lg bg-greenTint text-green shrink-0">
                <Icon name="check" strokeWidth={2.25} />
              </span>
              <p className="text-sm text-ink grow">{t("low.none")}</p>
              <Button icon="plus" onClick={() => setOrdering({ prefillLow: false })}>{t("order.new")}</Button>
            </Card>
          )}

          {incoming.length > 0 ? (
            <section className="flex flex-col gap-3">
              <SectionHead title={t("stat.awaitingReceipt")} count={incoming.length}
                description={t("stamp.checklist")} />
              {incoming.map((order) => (
                <OrderCard key={order.order_id} order={order} data={data} t={t} lang={lang} attention
                  onOpen={() => setDetail(order.order_id)} action={receiveButton(order)} />
              ))}
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === "orders" ? (
        <div className="flex flex-col gap-4 sm:gap-6">
          <SectionHead
            title={t("tab.orders")}
            count={data.orders.length}
            action={<Button variant="primary" icon="plus" onClick={() => setOrdering({ prefillLow: low.length > 0 })}>
              {t("order.new")}
            </Button>}
          />

          {incoming.length + openOrders.length === 0 && history.length === 0 ? (
            <Card><EmptyState icon="list" title={t("order.emptyShop")}
              action={<Button variant="primary" icon="plus" onClick={() => setOrdering({ prefillLow: true })}>{t("order.new")}</Button>} />
            </Card>
          ) : null}

          {incoming.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-brandStrong">
                {t("misc.needsAttention")}
              </h3>
              {incoming.map((order) => (
                <OrderCard key={order.order_id} order={order} data={data} t={t} lang={lang} attention
                  onOpen={() => setDetail(order.order_id)} action={receiveButton(order)} />
              ))}
            </section>
          ) : null}

          {openOrders.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
                {t("stat.openOrders")}
              </h3>
              {openOrders.map((order) => (
                <OrderCard key={order.order_id} order={order} data={data} t={t} lang={lang}
                  onOpen={() => setDetail(order.order_id)} action={isOwner ? cancelButton(order) : null} />
              ))}
            </section>
          ) : null}

          {history.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
                {t("status.Completed")}
              </h3>
              {history.map((order) => (
                <OrderCard key={order.order_id} order={order} data={data} t={t} lang={lang}
                  onOpen={() => setDetail(order.order_id)} />
              ))}
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === "stock" ? (
        <StockPanel
          data={data} location="shop" t={t} lang={lang} busy={busy}
          editable={isOwner}
          canRequestRemoval={!isOwner}
          stockRequests={data.stock_requests || []}
          stockBatches={data.stock_removal_batches || []}
          onRequestRemoval={(payload) => actions.requestDailyStockReport(payload).then(() => pushToast(t("stock.reportSent")))}
          onDecideStockRemoval={(payload) => actions.decideDailyStockReport(payload).then(() => pushToast(t(payload.approve ? "stock.reportApproved" : "stock.reportDenied")))}
          onExportMonthly={(payload) => actions.exportMonthlyStockCsv(payload)}
          onSaveAll={(payload) => actions.setStockBatch(payload)}
          onSave={(product_id, new_quantity, reason) =>
            actions.setStock({ location: "shop", product_id, new_quantity, reason })}
          onEditProduct={(payload) => actions.editProduct(payload).then(() => pushToast(t("product.updated")))}
          onSaved={() => pushToast(t("stock.saved"))}
          onAddProduct={(form) => actions.addProduct(form).then(() => pushToast(t("product.added")))}
          onArchiveProduct={(product_id) => actions.archiveProduct({ product_id }).then(() => pushToast(t("product.deleted")))}
          onSetLocationActive={(payload) => actions.setProductLocationActive(payload).then(() => pushToast(t(payload.active ? "stock.publishedShop" : "stock.hiddenLocation")))}
        />
      ) : null}

      <NewOrderModal
        open={Boolean(ordering)} onClose={() => setOrdering(null)} data={data} t={t} lang={lang}
        prefillLow={Boolean(ordering && ordering.prefillLow)} staff={data.staff}
        onSubmit={createOrder} busy={busy === "createOrder"}
      />

      <StampModal
        open={Boolean(receivingOrder)} onClose={() => setReceiving(null)} mode="receive"
        order={receivingOrder} data={data} t={t} lang={lang} staff={data.staff}
        onConfirm={receive} busy={busy === "receiveOrder"}
      />

      <CancelOrderModal
        open={Boolean(cancellingOrder)} onClose={() => setCancelling(null)}
        order={cancellingOrder} t={t} onConfirm={cancel} busy={busy === "cancelOrder"}
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
            {detailOrder && detailOrder.status === "Dispatched" ? (
              <Button variant="go" icon="check" onClick={() => { setReceiving(detailOrder.order_id); setDetail(null); }}>
                {t("action.receive")}
              </Button>
            ) : null}
            {isOwner && detailOrder && (detailOrder.status === "Pending" || detailOrder.status === "Adjusted") ? (
              <Button variant="secondary" onClick={() => setCancelling(detailOrder.order_id)}>
                {t("action.cancelOrder")}
              </Button>
            ) : null}
          </>
        }
      />
    </div>
  );
}
