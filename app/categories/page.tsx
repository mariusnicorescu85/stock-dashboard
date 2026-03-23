import React from "react";
import Link from "next/link";
import {
  fetchProducts,
  fetchDemandForYear,
  ProductRecord,
} from "@/lib/airtable";
import { computeStockDerived, fmtGB } from "@/lib/StockMath";
import CategoryWhatIfPanel from "./CategoryWhatIfPanel";

export const dynamic = "force-dynamic";

type SearchParams =
  | Promise<{ year?: string }>
  | { year?: string };

const SUPPORTED_YEARS = [2024, 2025, 2026];

const CATEGORY_CONFIG: {
  id: string;      // must match Airtable Category value (case-insensitive)
  label: string;   // UI label
  description: string;
}[] = [
  {
    id: "19mm",
    label: "19mm",
    description: "All 19mm styling items, all colours.",
  },
  {
    id: "25mm",
    label: "25mm",
    description: "All 25mm styling items, all colours.",
  },
  {
    id: "titanium",
    label: "Titanium",
    description: "All titanium tools and colours.",
  },
  {
    id: "infrared",
    label: "Infrared",
    description: "All infrared tools and colours.",
  },
  {
    id: "sets",
    label: "Sets",
    description: "All multi-piece sets, all colours.",
  },
  {
    id: "cerami",
    label: "Ceramic",
    description: "All ceramic tools and colours, including Aria.",
  },
  {
    id: "other",
    label: "Other (PYT Hairstyle)",
    description: "Other styling items for PYT Hairstyle that are not in the main categories.",
  },
];

function resolveYear(sp: { year?: string }): number {
  const raw = sp.year ? Number(sp.year) : NaN;
  if (SUPPORTED_YEARS.includes(raw)) return raw;
  // Default to latest supported year
  return SUPPORTED_YEARS[SUPPORTED_YEARS.length - 1];
}

function getDisplayYear(sp: SearchParams): Promise<number> {
  if (typeof (sp as any)?.then === "function") {
    return (sp as Promise<{ year?: string }>).then(resolveYear);
  }
  return Promise.resolve(resolveYear(sp as { year?: string }));
}

export default async function CategoriesPage(props: { searchParams?: SearchParams }) {
  const year = await getDisplayYear(props.searchParams ?? {});

  const [products, yearlyDemand] = await Promise.all([
    fetchProducts(),
    fetchDemandForYear(year),
  ]);

  // Helper: map name -> yearly units
  const demandByName = yearlyDemand;

  function productsInCategory(catId: string): ProductRecord[] {
    const catLower = catId.toLowerCase();

    // Special rule for "other": only show PYT Hairstyle items in the "other" category.
    if (catLower === "other") {
      return products.filter((p) => {
        const cat = (p.category ?? "").toLowerCase();
        const brand = (p.brand ?? "").toLowerCase();
        return cat === "other" && brand.includes("pyt");
      });
    }

    // Allow both "cerami" and "ceramic" spellings to be treated as the same category
    if (catLower === "cerami" || catLower === "ceramic") {
      return products.filter((p) => {
        const cat = (p.category ?? "").toLowerCase();
        return cat === "cerami" || cat === "ceramic";
      });
    }

    return products.filter(
      (p) => (p.category ?? "").toLowerCase() === catLower
    );
  }

  function totalForCategory(catId: string): number {
    return productsInCategory(catId).reduce(
      (sum, p) => sum + (demandByName.get(p.name) ?? 0),
      0
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Category demand overview</h1>
            <p className="text-sm text-slate-400">
              See which products sit in each category and how many units they sold in a year.
            </p>
          </div>
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
            ← Back to dashboard
          </Link>
        </div>

        {/* Year toggle */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">
                Time range
              </p>
              <p className="text-sm text-slate-400">
                Historical demand is available for 2024, 2025, and 2026.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400">Year:</span>
              {SUPPORTED_YEARS.map((y) => {
                const params = new URLSearchParams();
                params.set("year", String(y));
                const active = y === year;
                return (
                  <Link
                    key={y}
                    href={`/categories?${params.toString()}`}
                    className={`rounded-full border px-3 py-1.5 transition ${
                      active
                        ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100 shadow-[0_8px_24px_rgba(52,211,153,0.25)]"
                        : "border-slate-700/80 bg-slate-900/70 text-slate-200 hover:border-emerald-300/40 hover:text-emerald-100"
                    }`}
                  >
                    {y}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Categories overview */}
        <section className="space-y-4">
          {CATEGORY_CONFIG.map((cat) => {
            const items = productsInCategory(cat.id);

            if (items.length === 0) return null;

            const totalUnits = items.reduce(
              (sum, p) => sum + (demandByName.get(p.name) ?? 0),
              0
            );

            const totalCurrentStock = items.reduce(
              (sum, p) => sum + p.currentStock,
              0
            );
            const totalIncomingStock = items.reduce(
              (sum, p) => sum + p.incomingStockTotal,
              0
            );
            const totalDailyDemand = items.reduce(
              (sum, p) => sum + (p.dailyDemand ?? 0),
              0
            );
            const avgLeadTime =
              items.length > 0
                ? Math.round(
                    items.reduce(
                      (sum, p) =>
                        sum + (p.leadTimeDays != null ? p.leadTimeDays : 0),
                      0
                    ) / items.length
                  )
                : 0;

            return (
              <div
                key={cat.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.4)] space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      Category
                    </p>
                    <h2 className="text-lg font-semibold">{cat.label}</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {cat.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                      Total demand {year}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-300">
                      {totalUnits}
                    </p>
                    <p className="text-xs text-slate-500">
                      Across {items.length} item
                      {items.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                {/* Category-level what-if */}
                <CategoryWhatIfPanel
                  label={cat.label}
                  initialCurrentStock={totalCurrentStock}
                  initialIncomingStock={totalIncomingStock}
                  initialDailyDemand={totalDailyDemand}
                  initialLeadTimeDays={avgLeadTime}
                />

                <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/70">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-950/80 text-xs uppercase text-slate-400">
                      <tr>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-left">Brand</th>
                        <th className="px-3 py-2 text-right">Units {year}</th>
                        <th className="px-3 py-2 text-right">Current stock</th>
                        <th className="px-3 py-2 text-right">
                          Incoming stock
                        </th>
                        <th className="px-3 py-2 text-right">
                          Run-out date
                        </th>
                        <th className="px-3 py-2 text-right">Order-by date</th>
                        <th className="px-3 py-2 text-right">Qty to order</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items
                        .map((p) => ({
                          product: p,
                          units: demandByName.get(p.name) ?? 0,
                        }))
                        .sort((a, b) => b.units - a.units)
                        .map(({ product, units }) => {
                          // Use product's own dates if present; otherwise derive
                          // daily demand from yearly units (Option B) and compute.
                          let displayRunOut: string | null =
                            product.runOutDate;
                          let displayOrderBy: string | null =
                            product.orderByDate;

                          const yearlyDaily =
                            units > 0 ? units / 365 : 0;

                          if ((!displayRunOut || !displayOrderBy) && yearlyDaily > 0) {
                            const derived = computeStockDerived({
                              currentStock: product.currentStock,
                              incomingStock: product.incomingStockTotal,
                              dailyDemand: yearlyDaily,
                              leadTimeDays: product.leadTimeDays ?? 0,
                            });

                            displayRunOut = fmtGB(derived.runOutDate);
                            displayOrderBy = fmtGB(derived.orderByDate);
                          } else {
                            // Format existing ISO-like strings for consistency
                            displayRunOut = product.runOutDate
                              ? fmtGB(new Date(product.runOutDate))
                              : null;
                            displayOrderBy = product.orderByDate
                              ? fmtGB(new Date(product.orderByDate))
                              : null;
                          }

                          return (
                            <tr
                              key={product.id}
                              className="border-t border-slate-900/70 odd:bg-slate-900/40 even:bg-slate-900/20"
                            >
                              <td className="px-3 py-2">
                                <Link
                                  href={`/product/${product.id}`}
                                  className="text-slate-100 hover:underline"
                                >
                                  {product.name}
                                </Link>
                              </td>
                              <td className="px-3 py-2 text-slate-400">
                                {product.brand ?? "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-100">
                                {units}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-100">
                                {product.currentStock}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-100">
                                {product.incomingStockTotal}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-100">
                                {displayRunOut ?? "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-100">
                                {displayOrderBy ?? "—"}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-emerald-200 font-bold">
                                {product.qtyToOrder}
                              </td>
                            </tr>
                          );
                        })}

                      {items.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-3 py-4 text-center text-slate-400"
                          >
                            No products found for this category.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}



