import React, { useState } from "react";
import { Button, Card, EmptyState, SectionHead, Segmented } from "./ui.jsx";
import { OrderCard, OrderDetail } from "./orders.jsx";
import { ReviewModal } from "./FactoryDashboard.jsx";
import { StampModal } from "./StampModal.jsx";
import { FactoryIngredients } from "./FactoryIngredients.jsx";
import { StockPanel } from "./StockPanel.jsx";
import { itemsOf } from "../hooks/useInventory.js";
import { openOrderReceipt } from "../lib/receipt.js";
import { buildOrderRows } from "../lib/orderCsv.js";
import { downloadSheet } from "../lib/xlsxExport.js";

export function FactoryEmployeeDashboard({ data, t, lang, busy, actions, pushToast }) {
  const [tab, setTab] = useState("orders");
  const [detail, setDetail] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [sending, setSending] = useState(null);
  const orders = [...data.orders].sort((a, b) => {
    const active = (order) => ["Pending", "Adjusted", "Dispatched"].includes(order.status);
    return Number(active(b)) - Number(active(a)) || new Date(b.date) - new Date(a.date);
  });
  const pending = orders.filter((order) => ["Pending", "Adjusted"].includes(order.status)).length;
  const detailOrder = data.orders.find((order) => order.order_id === detail);
  const reviewingOrder = data.orders.find((order) => order.order_id === reviewing);
  const sendingOrder = data.orders.find((order) => order.order_id === sending);
  const sendOrder = async (name) => {
    await actions.dispatchOrder({ order_id: sending, dispatched_by: name });
    pushToast(t("toast.dispatched", { id: sending }));
    setSending(null);
    setDetail(null);
  };
  // Factory employees adjust quantities themselves — they're the ones
  // physically pulling stock for the van, so they know what's actually
  // available to send right now.
  const saveApproval = async (payload) => {
    await actions.saveApproval(payload);
    pushToast(t("toast.adjusted", { id: payload.order_id }));
  };
  const reviewAction = (order) => order.status === "Pending"
    ? <Button size="sm" variant="primary" icon="list" onClick={() => setReviewing(order.order_id)}>{t("action.review")}</Button>
    : order.status === "Adjusted"
      ? <Button size="sm" variant="primary" icon="truck" onClick={() => setSending(order.order_id)}>{t("action.sendOrder")}</Button>
      : null;
  return <div className="flex flex-col gap-4 sm:gap-6">
    <Segmented value={tab} onChange={setTab} options={[
      { value: "orders", label: `${t("factory.shopOrders")} (${pending})`, icon: "list" },
      { value: "ingredients", label: t("tab.ingredients"), icon: "list" },
      { value: "stock", label: t("tab.stock"), icon: "box" },
    ]} />
    {tab === "orders" ? <section className="flex flex-col gap-3">
      <SectionHead title={t("factory.shopOrders")} count={orders.length} />
      {orders.length ? orders.map((order) => <OrderCard key={order.order_id} order={order} data={data} t={t} lang={lang}
        attention={order.status === "Pending" || order.status === "Adjusted"} onOpen={() => setDetail(order.order_id)}
        action={reviewAction(order)} />)
        : <Card><EmptyState icon="list" title={t("order.emptyFactory")} /></Card>}
    </section> : null}
    {tab === "ingredients" ? <FactoryIngredients data={data} t={t} lang={lang} busy={busy} actions={actions} pushToast={pushToast} /> : null}
    {tab === "stock" ? <StockPanel data={data} location="factory" showBoth t={t} lang={lang} busy={busy} editable={false} /> : null}
    <ReviewModal order={reviewingOrder} data={data} t={t} lang={lang} busy={busy}
      onClose={() => setReviewing(null)} onSave={saveApproval} />
    <OrderDetail order={detailOrder} data={data} t={t} lang={lang} onClose={() => setDetail(null)}
      footer={<>
        <Button variant="ghost" onClick={() => setDetail(null)}>{t("order.close")}</Button>
        {detailOrder ? <Button icon="list" onClick={() => openOrderReceipt(detailOrder, data, t, lang)}>{t("action.receipt")}</Button> : null}
        {detailOrder ? <Button icon="list" variant="ghost" onClick={() => {
          const report = buildOrderRows(detailOrder, itemsOf(data, detailOrder.order_id), data, t);
          downloadSheet(report.filename, report.rows, { lang });
        }}>{t("action.downloadCsv")}</Button> : null}
        {detailOrder ? reviewAction(detailOrder) : null}
      </>} />
    <StampModal open={Boolean(sendingOrder)} onClose={() => setSending(null)} mode="dispatch"
      order={sendingOrder} data={data} t={t} lang={lang} staff={data.staff}
      onConfirm={sendOrder} busy={busy === "dispatchOrder"} />
  </div>;
}
