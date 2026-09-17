import { THEME_EXTEND } from "./src/theme.js";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: THEME_EXTEND },
  plugins: [],
};
