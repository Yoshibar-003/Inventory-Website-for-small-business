import React, { useEffect, useState } from "react";
import { Badge, Button, Field, InlineError, Modal, inputCls } from "./ui.jsx";
import { api } from "../lib/api.js";

const blank = { name: "", role: "employee", pin: "", active: true };

export function EmployeeManager({ open, onClose, t }) {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try { setAccounts(await api.staffAccounts()); }
    catch (e) { setError(t(e.code || "err.network")); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) { setForm(blank); load(); } }, [open]);

  const edit = (account) => setForm({ name: account.name, role: account.role, pin: "", active: account.active !== false });
  const save = async () => {
    setSaving(true); setError("");
    try {
      setAccounts(await api.saveStaffAccount(form));
      setForm(blank);
    } catch (e) { setError(t(e.code || "err.title")); }
    finally { setSaving(false); }
  };

  const selected = accounts.find((account) => account.name.toLowerCase() === form.name.trim().toLowerCase());
  const remove = async () => {
    if (!selected || !window.confirm(t("staff.deleteConfirm", { name: selected.name }))) return;
    setDeleting(true); setError("");
    try { setAccounts(await api.deleteStaffAccount({ name: selected.name })); setForm(blank); }
    catch (e) { setError(t(e.code || "err.title")); }
    finally { setDeleting(false); }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={t("staff.title")} description={t("staff.body")}
      footer={<Button variant="ghost" onClick={onClose}>{t("order.close")}</Button>}>
      <div className="grid md:grid-cols-[1fr_1fr] gap-5">
        <div className="rounded-xl border border-line divide-y divide-line overflow-hidden">
          {loading ? <p className="p-4 text-sm text-muted">{t("misc.loading")}</p> : accounts.map((account) => (
            <button key={account.name} type="button" onClick={() => edit(account)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-surface2">
              <span className="grow font-medium">{account.name}</span>
              <Badge tone={account.active ? "brand" : "neutral"}>{t("login." + account.role)}</Badge>
              {!account.active ? <span className="text-xs text-muted">{t("staff.disabled")}</span> : null}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <Field label={t("login.name")}><input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label={t("staff.role")}><select className={inputCls} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}><option value="employee">{t("login.employee")}</option><option value="factory_employee">{t("login.factory_employee")}</option><option value="manager">{t("login.manager")}</option><option value="owner">{t("login.owner")}</option></select></Field>
          <Field label={t("staff.newPin")} hint={t("staff.pinHint")}><input className={inputCls} type="password" inputMode="numeric" value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />{t("staff.active")}</label>
          {error ? <InlineError>{error}</InlineError> : null}
          <div className="flex gap-2 flex-wrap">
            {selected && selected.role !== "owner" ? <Button variant="danger" onClick={remove} loading={deleting}>{t("staff.delete")}</Button> : null}
            <div className="grow" />
            <Button variant="ghost" onClick={() => setForm(blank)}>{t("staff.new")}</Button>
            <Button variant="primary" onClick={save} loading={saving} disabled={!form.name.trim() || (!form.pin && !selected)}>{t("action.save")}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
