import React from "react";
import Link from "next/link";
import {
  fetchProducts,
  fetchDemandBreakdownForYear,
  ProductRecord,
} from "@/lib/airtable";
import { computeStockDerived, fmtGB, daysInYear } from "@/lib/StockMath";
import { monthlyForProduct } from "@/lib/categoryDemandDisplay";
import { monthlyHistoryYearsUpTo, EARLIEST_MONTHLY_HISTORY_YEAR } from "@/lib/categoryYears";
import CategoriesTabs, {
  type CategoryDemandBlock,
  type CategoryDemandRow,
  type YearSalesSlice,
} from "./CategoriesTabs";

export const dynamic = "force-dynamic";

type SearchParams =
  | Promise<{ year?: string }>
  | { year?: string };

const SUPPORTED_YEARS = [2024, 2025, 2026];

const CATEGORY_CONFIG: {
  id: string;
  label: string;
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
    description:
      "Other styling items for PYT Hairstyle that are not in the main categories.",
  },
];

function resolveYear(sp: { year?: string }): number {
  const raw = sp.year ? Number(sp.year) : NaN;
  if (SUPPORTED_YEARS.includes(raw)) return raw;
  return SUPPORTED_YEARS[SUPPORTED_YEARS.length - 1];
}

function getDisplayYear(sp: SearchParams): Promise<number> {
  if (
    sp !== null &&
    typeof sp === "object" &&
    "then" in sp &&
    typeof (sp as Promise<{ year?: string }>).then === "function"
  ) {
    return (sp as Promise<{ year?: string }>).then(resolveYear);
  }
  return Promise.resolve(resolveYear(sp as { year?: string }));
}

export default async function CategoriesPage(props: { searchParams?: SearchParams }) {
  const year = await getDisplayYear(props.searchParams ?? {});
  const histYears = monthlyHistoryYearsUpTo(year);

  const [products, ...breakdownList] = await Promise.all([
    fetchProducts(),
    ...histYears.map((y) => fetchDemandBreakdownForYear(y)),
  ]);

  const breakdownByYear = new Map<number, Map<string, number[]>>();
  histYears.forEach((y, i) => {
    breakdownByYear.set(y, breakdownList[i] as Map<string, number[]>);
  });

  const daysInYearByYear = histYears.map((y) => ({
    year: y,
    days: daysInYear(y),
  }));

  const daysInYearPrimary = daysInYear(year);

  function productsInCategory(catId: string): ProductRecord[] {
    const catLower = catId.toLowerCase();

    if (catLower === "other") {
      return products.filter((p) => {
        const c = (p.category ?? "").toLowerCase();
        const brand = (p.brand ?? "").toLowerCase();
        return c === "other" && brand.includes("pyt");
      });
    }

    if (catLower === "cerami" || catLower === "ceramic") {
      return products.filter((p) => {
        const c = (p.category ?? "").toLowerCase();
        return c === "cerami" || c === "ceramic";
      });
    }

    return products.filter(
      (p) => (p.category ?? "").toLowerCase() === catLower
    );
  }

  function rowForProduct(product: ProductRecord): CategoryDemandRow {
    const byYear: YearSalesSlice[] = histYears.map((y) => {
      const bd = breakdownByYear.get(y)!;
      const months = monthlyForProduct(bd, product.name);
      const totalUnits = months.reduce((sum, u) => sum + u, 0);
      return { year: y, totalUnits, months };
    });

    const primarySlice = byYear.find((s) => s.year === year)!;
    const unitsYear = primarySlice.totalUnits;

    let displayRunOut: string | null = product.runOutDate;
    let displayOrderBy: string | null = product.orderByDate;

    const yearlyDaily =
      unitsYear > 0 ? unitsYear / daysInYearPrimary : 0;

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
      displayRunOut = product.runOutDate
        ? fmtGB(new Date(product.runOutDate))
        : null;
      displayOrderBy = product.orderByDate
        ? fmtGB(new Date(product.orderByDate))
        : null;
    }

    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      byYear,
      sheetDaily: product.dailyDemand ?? 0,
      currentStock: product.currentStock,
      incomingStockTotal: product.incomingStockTotal,
      runOut: displayRunOut,
      orderBy: displayOrderBy,
      qtyToOrder: product.qtyToOrder,
    };
  }

  const blocks: CategoryDemandBlock[] = [];

  for (const cat of CATEGORY_CONFIG) {
    const items = productsInCategory(cat.id);
    if (items.length === 0) continue;

    const rows = items.map(rowForProduct);

    const totalsByYear = histYears.map((y) => {
      const bd = breakdownByYear.get(y)!;
      const total = items.reduce((sum, p) => {
        const m = monthlyForProduct(bd, p.name);
        return sum + m.reduce((a, b) => a + b, 0);
      }, 0);
      return { year: y, total };
    });

    const totalCurrentStock = items.reduce((sum, p) => sum + p.currentStock, 0);
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

    blocks.push({
      id: cat.id,
      label: cat.label,
      description: cat.description,
      primaryYear: year,
      totalsByYear,
      totalCurrentStock,
      totalIncomingStock,
      totalDailyDemand,
      avgLeadTime,
      items: rows,
    });
  }

  const yearSpanLabel =
    histYears.length > 1
      ? `${histYears[0]}–${year}`
      : String(year);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Category demand overview</h1>
            <p className="text-sm text-slate-400">
              Primary year (below) drives run-out math and the highlighted column.
              <strong className="text-slate-300">Monthly (Jan–Dec)</strong> tab
              and Overview include all loaded years{" "}
              <strong className="text-slate-300">{yearSpanLabel}</strong> (from{" "}
              {EARLIEST_MONTHLY_HISTORY_YEAR} through the selected year). To load
              older data, lower{" "}
              <code className="text-slate-300">EARLIEST_MONTHLY_HISTORY_YEAR</code>{" "}
              in <code className="text-slate-300">lib/categoryYears.ts</code>.
            </p>
          </div>
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
            ← Back to dashboard
          </Link>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">
                Primary year
              </p>
              <p className="text-sm text-slate-400">
                Monthly history loaded: {histYears.join(", ")}.
              </p>
              <p className="mt-2 text-sm text-slate-300">
                <span className="text-emerald-300/90">Monthly detail:</span> scroll
                to the two buttons under this box and choose{" "}
                <strong className="font-medium text-slate-100">
                  Monthly (Jan–Dec)
                </strong>{" "}
                — that tab shows Jan–Dec columns for each year.
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

        <CategoriesTabs
          primaryYear={year}
          historyYearsAsc={histYears}
          daysInYearByYear={daysInYearByYear}
          blocks={blocks}
        />
      </div>
    </main>
  );
}
