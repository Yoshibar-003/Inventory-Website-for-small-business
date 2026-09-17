import React, { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Field, Icon, InlineError, Segmented, Spinner, Toasts, inputCls } from "./components/ui.jsx";
import { ShopDashboard } from "./components/ShopDashboard.jsx";
import { FactoryDashboard } from "./components/FactoryDashboard.jsx";
import { EmployeeManager } from "./components/EmployeeManager.jsx";
import { FactoryIngredients } from "./components/FactoryIngredients.jsx";
import { FactoryEmployeeDashboard } from "./components/FactoryEmployeeDashboard.jsx";
import { makeT } from "./lib/i18n.js";
import { api, setAuthToken } from "./lib/api.js";
import { safeStore, useInventory } from "./hooks/useInventory.js";
import { hasPushSubscription, isPushSupported, subscribeToPush, unsubscribeFromPush } from "./lib/push.js";

function Logo() {
  return (
    <img src={`${import.meta.env.BASE_URL}1213-logo.jpg`} alt="1213 Ice Cream" className="w-10 h-10 rounded-xl object-cover shrink-0" />
  );
}

function savedUser() {
  try {
    const user = JSON.parse(safeStore.get("scoop.sql.user", "null"));
    if (user?.expires_at && Date.now() < Number(user.expires_at)) return user;
    setAuthToken("");
    safeStore.set("scoop.sql.user", "null");
    return null;
  } catch (_) { return null; }
}

function Login({ t, onLogin }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const user = await api.login({ name: name.trim(), pin });
      setAuthToken(user.token);
      onLogin({ name: user.name, role: user.role, expires_at: user.expires_at });
    } catch (err) { setError(t(err.code || "err.login")); }
    finally { setBusy(false); }
  };
  return (
    <main className="min-h-[calc(100vh-4rem)] grid place-items-center px-4 py-10">
      <Card className="w-full max-w-sm p-6">
        <h1 className="font-display text-2xl font-bold">{t("login.title")}</h1>
        <p className="text-sm text-muted mt-1 mb-5">{t("login.body")}</p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label={t("login.name")}><input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label={t("login.pin")}><input className={inputCls} type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} /></Field>
          {error ? <InlineError>{error}</InlineError> : null}
          <Button type="submit" variant="primary" loading={busy} disabled={!name.trim() || !pin}>{t("login.button")}</Button>
        </form>
      </Card>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(savedUser);
  const [role, setRole] = useState(() => safeStore.get("scoop.role", "shop"));
  const [lang, setLang] = useState(() => safeStore.get("scoop.lang", "th"));
  const [managingStaff, setManagingStaff] = useState(false);
  const [notifOn, setNotifOn] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);
  const { data, loading, busy, error, toasts, setError, pushToast, dismissToast, reload, actions } = useInventory(Boolean(user));

  const t = useMemo(() => makeT(lang), [lang]);

  useEffect(() => {
    safeStore.set("scoop.role", role);
    safeStore.set("scoop.lang", lang);
    document.documentElement.lang = lang;
  }, [role, lang]);

  // Owner and manager both oversee shop and factory and get the same stock-edit
  // and approval powers; only staff/PIN management (below) stays owner-only.
  const isElevated = Boolean(user) && (user.role === "owner" || user.role === "manager");

  useEffect(() => {
    safeStore.set("scoop.sql.user", JSON.stringify(user));
    if (user?.role === "factory_employee" && role !== "factory") setRole("factory");
    if (user?.role === "employee" && role !== "shop") setRole("shop");
  }, [user, role]);

  const logout = () => {
    api.logout().catch(() => {});
    setAuthToken("");
    setUser(null);
    safeStore.set("scoop.sql.user", "null");
  };

  useEffect(() => {
    if (!user || !isPushSupported()) { setNotifOn(false); return; }
    hasPushSubscription().then(setNotifOn);
  }, [user]);

  const toggleNotifications = async () => {
    setNotifBusy(true);
    try {
      if (notifOn) {
        await unsubscribeFromPush(api);
        setNotifOn(false);
      } else {
        await subscribeToPush(api);
        setNotifOn(true);
        pushToast(t("push.enabled"));
      }
    } catch (e) {
      if (e.message === "push.denied") pushToast(t("push.blockedHint"), "error");
    } finally {
      setNotifBusy(false);
    }
  };

  useEffect(() => {
    if (!user?.expires_at) return;
    const remaining = Number(user.expires_at) - Date.now();
    if (remaining <= 0) { logout(); return; }
    const timer = window.setTimeout(logout, remaining);
    return () => window.clearTimeout(timer);
  }, [user]);

  return (
    <div className="min-h-screen bg-page text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-page/85 backdrop-blur">
        <div className="mx-auto max-w-[1180px] px-3 sm:px-6 min-h-16 py-2 flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <Logo />
            <div className="leading-tight">
              <p className="font-display font-bold text-[17px] tracking-tight text-ink">{t("app.name")}</p>
              <p className="text-[12px] text-muted hidden sm:block">{t("app.sub")}</p>
            </div>
          </div>

          <div className="grow" />

          {isElevated ? <div className="order-3 w-full sm:order-none sm:w-auto [&>div]:w-full [&>div>button]:flex-1 sm:[&>div>button]:flex-none"><Segmented
            value={role}
            onChange={setRole}
            options={[
              { value: "shop", label: t("role.shop"), icon: "store" },
              { value: "factory", label: t("role.factory"), icon: "factory" },
            ]}
          /></div> : null}

          {user ? <div className="hidden sm:flex items-center gap-2 text-sm text-muted">
            <span>{user.name}</span><Badge>{t("login." + user.role)}</Badge>
            {user.role === "owner" ? <Button size="sm" variant="ghost" onClick={() => setManagingStaff(true)}>{t("staff.manage")}</Button> : null}
            {isPushSupported() ? <Button size="sm" variant={notifOn ? "primary" : "ghost"} icon="bell" loading={notifBusy}
              onClick={toggleNotifications} title={t(notifOn ? "push.on" : "push.off")}>
              {t(notifOn ? "push.on" : "push.off")}
            </Button> : null}
            <Button size="sm" variant="ghost" onClick={logout}>{t("login.logout")}</Button>
          </div> : null}

          <Segmented
            size="sm"
            value={lang}
            onChange={setLang}
            options={[{ value: "th", label: "ไทย" }, { value: "lo", label: "ລາວ" }, { value: "en", label: "EN" }]}
          />
        </div>
        {user ? <div className="sm:hidden border-t border-line/70 px-4 py-2 flex items-center gap-2 text-sm">
          <span className="min-w-0 truncate text-muted">{user.name}</span>
          <Badge>{t("login." + user.role)}</Badge>
          <div className="grow" />
          {user.role === "owner" ? <Button size="sm" variant="ghost" onClick={() => setManagingStaff(true)}>{t("staff.manage")}</Button> : null}
          {isPushSupported() ? <Button size="sm" variant={notifOn ? "primary" : "ghost"} icon="bell" loading={notifBusy}
            onClick={toggleNotifications} aria-label={t(notifOn ? "push.on" : "push.off")} title={t(notifOn ? "push.on" : "push.off")} /> : null}
          <Button size="sm" variant="ghost" onClick={logout}>{t("login.logout")}</Button>
        </div> : null}
      </header>

      {!user ? <Login t={t} onLogin={setUser} /> : <main className="mx-auto max-w-[1180px] px-3 sm:px-6 py-4 sm:py-8 pb-[max(5rem,env(safe-area-inset-bottom))] sm:pb-8 flex flex-col gap-4 sm:gap-5">
        {error ? (
          <InlineError onRetry={() => { setError(null); reload(); }} retryLabel={t("action.retry")}>
            {t(error.code, error.vars)}
          </InlineError>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-24 text-muted">
            <Spinner className="w-5 h-5" />
            <span className="text-sm">{t("misc.loading")}</span>
          </div>
        ) : user.role === "factory_employee" ? (
          <FactoryEmployeeDashboard data={data} t={t} lang={lang} busy={busy} actions={actions} pushToast={pushToast} />
        ) : role === "shop" ? (
          <ShopDashboard data={data} t={t} lang={lang} busy={busy} actions={actions} pushToast={pushToast} isOwner={isElevated} />
        ) : (
          <FactoryDashboard data={data} t={t} lang={lang} busy={busy} actions={actions} pushToast={pushToast} />
        )}
      </main>}

      <Toasts toasts={toasts} onDismiss={dismissToast} />
      <EmployeeManager open={managingStaff} onClose={() => setManagingStaff(false)} t={t} />
    </div>
  );
}
