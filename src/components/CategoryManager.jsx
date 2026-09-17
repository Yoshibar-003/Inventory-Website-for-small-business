import React, { useState } from "react";
import { Button, Field, InlineError, Modal, inputCls } from "./ui.jsx";
export function CategoryManager({ open, onClose, categories, actions, busy, t }) {
  const [newName, setNewName] = useState(""); const [names, setNames] = useState({}); const [error, setError] = useState("");
  const run = async (fn) => { try { setError(""); await fn(); } catch (e) { setError(t(e.code || "err.title", e.vars)); } };
  return <Modal open={open} onClose={onClose} title={t("category.manage")} description={t("category.manageBody")}><div className="flex flex-col gap-4">
    <div className="flex flex-col sm:flex-row gap-2"><input className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("category.newName")} /><Button icon="plus" loading={busy === "addCategory"} disabled={!newName.trim()} onClick={() => run(async () => { await actions.addCategory({ name: newName }); setNewName(""); })}>{t("action.add")}</Button></div>
    <div className="divide-y divide-line border border-line rounded-xl">{categories.map((category) => <div key={category} className="p-3 flex flex-col sm:flex-row gap-2 sm:items-end"><Field label={t("product.category")}><input className={inputCls} value={names[category] ?? category} onChange={(e) => setNames((value) => ({ ...value, [category]: e.target.value }))} /></Field><Button size="sm" loading={busy === "renameCategory:" + category} disabled={!String(names[category] ?? category).trim() || (names[category] ?? category) === category} onClick={() => run(() => actions.renameCategory({ old_name: category, new_name: names[category] }))}>{t("action.save")}</Button><Button size="sm" variant="danger" icon="trash" loading={busy === "deleteCategory:" + category} onClick={() => window.confirm(t("category.deleteConfirm", { name: category })) && run(() => actions.deleteCategory({ name: category }))}>{t("product.delete")}</Button></div>)}</div>
    {error ? <InlineError>{error}</InlineError> : null}
  </div></Modal>;
}
