import React, { useEffect, useRef, useState } from "react";

export const cx = (...parts) => parts.filter(Boolean).join(" ");

// ---- Icons --------------------------------------------------------------
const PATHS = {
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  check: "M20 6L9 17l-5-5",
  x: "M18 6L6 18M6 6l12 12",
  alert: "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  truck: "M1 3h15v13H1zM16 8h4l3 3v5h-7V8z M5.5 19.5a2 2 0 100-4 2 2 0 000 4z M18.5 19.5a2 2 0 100-4 2 2 0 000 4z",
  box: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
  camera: "M4 7h3l1.5-2h7L17 7h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2zM12 10a4 4 0 100 8 4 4 0 000-8z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  refresh: "M3 12a9 9 0 0115.5-6.2M21 12a9 9 0 01-15.5 6.2M18 3v5h-5M6 21v-5h5",
  snow: "M12 2v20M4.2 7l15.6 10M19.8 7L4.2 17M9 4l3 3 3-3M9 20l3-3 3 3",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  store: "M3 9l1.5-5h15L21 9M3 9h18v11H3zM9 20v-6h6v6",
  factory: "M3 21h18M4 21V9l5 3V9l5 3V9l5 3v9M9 21v-4h2v4M14 21v-4h2v4",
  trash: "M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6",
  edit: "M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z",
  bell: "M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
};

export function Icon({ name, className = "w-4 h-4", strokeWidth = 1.75 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Spinner({ className = "w-4 h-4" }) {
  return (
    <svg className={cx(className, "animate-spin")} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ---- Buttons ------------------------------------------------------------
const BTN = {
  primary: "bg-brand text-onBrand border-brand hover:bg-brandStrong hover:border-brandStrong",
  secondary: "bg-surface text-ink border-line2 hover:border-ink hover:bg-surface2",
  ghost: "bg-transparent text-muted border-transparent hover:text-ink hover:bg-surface2",
  danger: "bg-red text-white border-red hover:opacity-90",
  go: "bg-green text-white border-green hover:opacity-90",
};
const SIZE = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-[15px] gap-2",
};

export function Button({
  variant = "secondary", size = "md", icon, loading, className, children, ...rest
}) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        "inline-flex items-center justify-center rounded-lg border font-medium tracking-tight min-h-11 sm:min-h-0",
        "transition-colors duration-150 focus-ring disabled:opacity-45 disabled:pointer-events-none",
        BTN[variant], SIZE[size], className
      )}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

// ---- Status & badges ----------------------------------------------------
const TONE = {
  amber: "bg-amberTint text-amber",
  steel: "bg-steelTint text-steel",
  blue: "bg-blueTint text-blue",
  green: "bg-greenTint text-green",
  red: "bg-redTint text-red",
  brand: "bg-brandTint text-brandStrong",
  neutral: "bg-surface2 text-muted",
};

export const STATUS_TONE = {
  Pending: "amber",
  Adjusted: "steel",
  Dispatched: "blue",
  Completed: "green",
  Cancelled: "neutral",
  Denied: "red",
};

export function Badge({ tone = "neutral", className, children }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
        "uppercase tracking-[0.06em] whitespace-nowrap",
        TONE[tone], className
      )}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status, t }) {
  const tone = STATUS_TONE[status] || "neutral";
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-1 text-xs font-semibold", TONE[tone])}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {t("status." + status)}
    </span>
  );
}

// ---- Stepper ------------------------------------------------------------
export function Stepper({
  value, onChange, min = 0, max = 9999, step = 1, disabled, size = "md", label,
}) {
  const clamp = (n) => Math.max(min, Math.min(max, n));
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(String(value)); }, [value]);
  const commit = (raw = text) => {
    const digits = String(raw).replace(/[^0-9]/g, "");
    const next = clamp(digits === "" ? min : parseInt(digits, 10));
    setText(String(next));
    if (next !== Number(value)) onChange(next);
  };
  const changeBy = (amount) => {
    const current = /^\d+$/.test(text) ? Number(text) : Number(value);
    const next = clamp(current + amount);
    setText(String(next)); onChange(next);
  };
  const h = size === "sm" ? "h-8" : "h-10";
  const w = size === "sm" ? "w-14" : "w-16";
  const btn = "grid place-items-center aspect-square text-muted hover:text-ink hover:bg-surface2 disabled:opacity-30 disabled:pointer-events-none transition-colors focus-ring rounded-md";
  return (
    <div className={cx("inline-flex items-center rounded-lg border border-line2 bg-surface", h)} role="group" aria-label={label}>
      <button type="button" className={cx(btn, h)} onClick={() => changeBy(-step)} disabled={disabled || Number(text) <= min} aria-label="−"><Icon name="minus" className="w-3.5 h-3.5" strokeWidth={2.25} /></button>
      <input type="text" inputMode="numeric" pattern="[0-9]*" value={text} disabled={disabled} aria-label={label}
        onChange={(event) => setText(event.target.value.replace(/[^0-9]/g, ""))}
        onFocus={(event) => { focused.current = true; event.target.select(); }}
        onBlur={() => { focused.current = false; commit(); }}
        onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
        className={cx("text-center font-mono tabular-nums bg-transparent text-ink outline-none border-x border-line2 h-full", w, size === "sm" ? "text-sm" : "text-[15px]")} />
      <button type="button" className={cx(btn, h)} onClick={() => changeBy(step)} disabled={disabled || Number(text) >= max} aria-label="+"><Icon name="plus" className="w-3.5 h-3.5" strokeWidth={2.25} /></button>
    </div>
  );
}
// ---- Segmented control --------------------------------------------------
export function Segmented({ value, onChange, options, size = "md" }) {
  return (
    <div className={cx("inline-flex max-w-full items-center gap-1 rounded-xl bg-surface2 p-1 overflow-x-auto", size === "sm" && "text-[13px]")}>
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={on}
            className={cx(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg font-medium transition-colors focus-ring",
              size === "sm" ? "px-2.5 h-7" : "px-3.5 h-9 text-sm",
              on ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink"
            )}
          >
            {opt.icon ? <Icon name={opt.icon} className="w-4 h-4" /> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ---- Layout helpers -----------------------------------------------------
export function Card({ className, children, ...rest }) {
  return (
    <div {...rest} className={cx("rounded-xl border border-line bg-surface", className)}>
      {children}
    </div>
  );
}

export function SectionHead({ title, count, action, description }) {
  return (
    <div className="flex items-start sm:items-end justify-between gap-3 sm:gap-4 flex-wrap">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink tracking-tight flex items-center gap-2">
          {title}
          {typeof count === "number" ? (
            <span className="font-mono text-sm font-medium text-muted tabular-nums">{count}</span>
          ) : null}
        </h2>
        {description ? <p className="text-sm text-muted mt-0.5">{description}</p> : null}
      </div>
      {action ? <div className="w-full sm:w-auto [&>button]:w-full sm:[&>button]:w-auto">{action}</div> : null}
    </div>
  );
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx("flex flex-col gap-1.5", className)}>
      <span className="text-[13px] font-medium text-muted">{label}</span>
      {children}
      {error ? <span className="text-[12px] text-red">{error}</span> : hint ? (
        <span className="text-[12px] text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputCls =
  "h-10 w-full rounded-lg border border-line2 bg-surface px-3 text-sm text-ink " +
  "placeholder:text-muted/70 outline-none focus:border-brand focus-ring-inset transition-colors";

export function EmptyState({ icon = "box", title, body, action }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-14 px-6">
      <span className="grid place-items-center w-11 h-11 rounded-xl bg-surface2 text-muted">
        <Icon name={icon} className="w-5 h-5" />
      </span>
      <div>
        <p className="font-medium text-ink">{title}</p>
        {body ? <p className="text-sm text-muted mt-1 max-w-sm">{body}</p> : null}
      </div>
      {action ? <div className="w-full sm:w-auto [&>button]:w-full sm:[&>button]:w-auto">{action}</div> : null}
    </div>
  );
}

// ---- Modal --------------------------------------------------------------
export function Modal({ open, onClose, title, description, children, footer, size = "md" }) {
  const panelRef = useRef(null);
  const bodyRef = useRef(null);
  // Keep the latest onClose in a ref so the effect below doesn't need it as a
  // dependency — onClose is passed as an inline arrow function by every caller,
  // so a new reference is created on every parent re-render (e.g. every
  // keystroke). If onClose were in the deps array, the effect would tear down
  // and re-run on every render — re-focusing the first input and re-triggering
  // the browser's scroll-into-view each time. That's the "bounce".
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Scope to the body content only — querying panelRef would match the header's
    // close (X) button first, since it sits earlier in the DOM than any body input,
    // stealing focus onto the close button whenever a modal opens.
    const focusable = bodyRef.current && bodyRef.current.querySelector("input, button, textarea, select");
    if (focusable) setTimeout(() => focusable.focus(), 40);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  const width = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-scrim/45 backdrop-blur-[2px] animate-fade" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "relative w-full bg-surface border border-line shadow-lift animate-rise",
          "rounded-t-2xl sm:rounded-2xl flex flex-col min-h-0 max-h-[94dvh] sm:max-h-[86vh]", width
        )}
      >
        <header className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-line">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink tracking-tight">{title}</h2>
            {description ? <p className="text-sm text-muted mt-1 max-w-prose">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose}
            className="grid place-items-center w-8 h-8 rounded-lg text-muted hover:text-ink hover:bg-surface2 focus-ring shrink-0"
            aria-label="Close">
            <Icon name="x" />
          </button>
        </header>
        <div ref={bodyRef} className="modal-scroll min-h-0 overflow-y-auto px-5 sm:px-6 py-5 grow">{children}</div>
        {footer ? (
          <footer className="sticky bottom-0 z-10 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-line bg-surface rounded-b-2xl pb-[max(.75rem,env(safe-area-inset-bottom))] [&>button]:w-full sm:[&>button]:w-auto">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

// ---- Toasts & errors ----------------------------------------------------
export function Toasts({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cx(
            "pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-2.5 shadow-lift animate-rise",
            "text-sm font-medium max-w-md",
            toast.tone === "error"
              ? "bg-redTint border-red/30 text-red"
              : "bg-ink text-page border-transparent"
          )}
          onClick={() => onDismiss(toast.id)}
        >
          <Icon name={toast.tone === "error" ? "alert" : "check"} className="w-4 h-4 shrink-0" strokeWidth={2.25} />
          {toast.message}
        </div>
      ))}
    </div>
  );
}

// ---- Stat tile ----------------------------------------------------------
export function StatTile({ label, value, tone = "neutral", hint, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button", onClick } : {})}
      className={cx(
        "flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-3.5 text-left",
        onClick && "hover:border-line2 focus-ring transition-colors"
      )}
    >
      <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">{label}</span>
      <span className={cx("font-display text-[28px] leading-none font-semibold tabular-nums",
        tone === "alert" ? "text-brandStrong" : tone === "go" ? "text-green" : "text-ink")}>
        {value}
      </span>
      {hint ? <span className="text-[12px] text-muted">{hint}</span> : null}
    </Tag>
  );
}

export function InlineError({ children, onRetry, retryLabel }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-red/25 bg-redTint px-3.5 py-2.5 text-sm text-red">
      <Icon name="alert" className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2.25} />
      <span className="grow">{children}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2 focus-ring rounded">
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}