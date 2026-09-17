import React from "react";
import { Card } from "./ui.jsx";
import { productVisible, stockOf } from "../hooks/useInventory.js";
import { categoryName } from "../lib/i18n.js";

export function CategorySummary({ data, location, t }) {
  const rows = Object.values(data.products.filter((product) => product.active !== false && productVisible(data, location, product.product_id)).reduce((map, product) => {
    const key = product.category || "Other";
    map[key] ||= { category: key, products: 0, quantity: 0 };
    map[key].products += 1;
    map[key].quantity += stockOf(data, location, product.product_id);
    return map;
  }, {})).sort((a, b) => a.category.localeCompare(b.category));
  return <section>
    <h2 className="font-display font-semibold text-lg mb-3">{t("stock.categories")}</h2>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {rows.map((row) => <Card key={row.category} className="p-4">
        <p className="text-sm font-medium text-ink">{categoryName(t, row.category)}</p>
        <p className="font-display text-2xl font-bold mt-2">{row.quantity}</p>
        <p className="text-xs text-muted mt-1">{t("stock.categoryProducts", { n: row.products })}</p>
      </Card>)}
    </div>
  </section>;
}
