/**
 * One source of truth for the design tokens, shared by the Vite build (tailwind.config.js)
 * and the single-file preview (tools/build-preview.mjs inlines it verbatim).
 * Colours resolve to CSS custom properties so light/dark is a token swap, not a class fork.
 */
const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export const THEME_EXTEND = {
  colors: {
    page: c("page"),
    surface: c("surface"),
    surface2: c("surface-2"),
    line: c("line"),
    line2: c("line-2"),
    ink: c("ink"),
    muted: c("muted"),
    brand: c("brand"),
    brandStrong: c("brand-strong"),
    brandTint: c("brand-tint"),
    onBrand: c("on-brand"),
    amber: c("amber"),
    amberTint: c("amber-tint"),
    steel: c("steel"),
    steelTint: c("steel-tint"),
    blue: c("blue"),
    blueTint: c("blue-tint"),
    green: c("green"),
    greenTint: c("green-tint"),
    red: c("red"),
    redTint: c("red-tint"),
    scrim: c("scrim"),
  },
  fontFamily: {
    display: ['"Bai Jamjuree"', '"IBM Plex Sans Thai"', "system-ui", "sans-serif"],
    sans: ['"IBM Plex Sans Thai"', '"IBM Plex Sans"', "system-ui", "sans-serif"],
    mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
  },
  spacing: { 4.5: "1.125rem" },
  boxShadow: {
    soft: "0 1px 2px rgb(var(--c-shadow) / 0.06), 0 4px 12px -4px rgb(var(--c-shadow) / 0.10)",
    lift: "0 12px 40px -12px rgb(var(--c-shadow) / 0.35), 0 2px 8px -2px rgb(var(--c-shadow) / 0.12)",
  },
  keyframes: {
    fade: { from: { opacity: "0" }, to: { opacity: "1" } },
    rise: { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "none" } },
  },
  animation: {
    fade: "fade 160ms ease-out",
    rise: "rise 200ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
};
