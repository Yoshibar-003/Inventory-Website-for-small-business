/**
 * The site's own default font, per language (see the html[lang] rules in
 * src/index.css) — Lao gets "Phetsarath", Thai and English get "IBM Plex
 * Sans Thai". Matching it here is best-effort: Excel can only render a font
 * if the viewer's machine has it installed — it can't pull in the web font
 * the way a browser does — but setting it means Excel uses it wherever it's
 * available and falls back gracefully (to its own default) otherwise.
 */
export function siteFontFor(lang) {
  return lang === "lo" ? "Phetsarath" : "IBM Plex Sans Thai";
}

/**
 * Picks a readable column width per column from the sheet's own content —
 * the way someone sizing a template by hand would — instead of leaving every
 * column at Excel's cramped default width.
 */
export function autoColWidths(rows, { min = 8, max = 44, padding = 2 } = {}) {
  const widths = [];
  rows.forEach((row) => {
    (row || []).forEach((cell, i) => {
      const len = String(cell ?? "").length;
      widths[i] = Math.max(widths[i] || min, Math.min(max, len + padding));
    });
  });
  return widths;
}

/**
 * Builds a one-sheet workbook from `rows` (an array of arrays — ragged rows
 * are fine), sized and fonted like a hand-made template, and returns it as
 * an ArrayBuffer ready to save or download.
 */
async function buildWorkbookBuffer(rows, { sheetName = "Sheet1", colWidths, lang } = {}) {
  // Loaded on demand — exceljs is a sizeable library, and most page visits
  // never trigger an export, so it shouldn't cost anything on initial load.
  const mod = await import("exceljs");
  const ExcelJS = mod.default || mod;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  rows.forEach((row) => worksheet.addRow(row));
  (colWidths || autoColWidths(rows)).forEach((width, i) => {
    worksheet.getColumn(i + 1).width = width;
  });
  const font = siteFontFor(lang);
  worksheet.eachRow((row) => { row.font = { name: font, size: 11 }; });
  return workbook.xlsx.writeBuffer();
}

/** Builds a one-sheet workbook from `rows` and triggers a browser download as .xlsx. */
export async function downloadSheet(filename, rows, opts = {}) {
  const buffer = await buildWorkbookBuffer(rows, opts);
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Downloads a base64-encoded .xlsx payload (built server-side) as a file. */
export function downloadBase64Xlsx(filename, base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
