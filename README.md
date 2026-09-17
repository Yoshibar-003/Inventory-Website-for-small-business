# 1213 Ice Cream Operations Demo

**A multilingual inventory and order workflow for an ice cream shop and factory.** This recruiter demo runs entirely in the browser with sample data. It never connects to the business's live database.

**[Open the interactive demo](https://yoshibar-003.github.io/Inventory-Website-for-small-business/)**

Sign in with **Owner / 1234** to explore both shop and factory views. Other sample accounts: **Shop Employee / 1111**, **Factory Employee / 2222**, and **Manager / 3333**. These are demo-only PINs. Select **EN** in the top-right corner to switch to English; Thai and Lao are also available.

## What to try

1. View low-stock products and draft a shop order.
2. Switch to the factory to review, adjust, and dispatch it.
3. Switch back to the shop to confirm receipt and see stock update.
4. Explore product categories, stock adjustments, reports, and spreadsheet exports.

The sample data resets when the page reloads. No account or personal information is required.

## What I built

- A React interface with role-specific shop, factory, staff, and manager views in Thai, Lao, and English.
- An order lifecycle with approval, dispatch, receipt, cancellation, and stock reconciliation.
- Product and category management, low-stock summaries, stock adjustment reasons, receipts, and exports.
- A local mock API with the same client actions used by the full project, so the workflow can be explored safely without a backend.

The production project uses Netlify Functions and Supabase/PostgreSQL for server-side validation and persistent data. This portfolio repository intentionally contains only the frontend and sample-data mock. It does not include production credentials, the live database, or backend code. The original application is a separate project.

## Run locally

```bash
npm ci
npm run dev:client
```

Open the URL printed by Vite (normally `http://127.0.0.1:5173`). To check the deployable build:

```bash
npm run build
npm run preview
```

The demo is always in mock mode. The GitHub Pages workflow publishes `dist/` after pushes to `main`; Pages must use **GitHub Actions** as its publishing source in the repository settings.

## Stack

React, JavaScript, Vite, Tailwind CSS, and ExcelJS. The full project also uses Netlify Functions and Supabase.

