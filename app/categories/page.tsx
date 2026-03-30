import React from "react";
import Link from "next/link";
import {
  fetchProducts,
  fetchDemandBreakdownForYear,
  ProductRecord,
} from "@/lib/airtable";
import { computeStockDerived, fmtGB, daysInYear } from "@/lib/StockMath";
import { monthlyForProduct } from "@/lib/categoryDemandDisplay";
import { monthlyHistoryYearsUpTo } from "@/lib/categoryYears";
import CategoriesTabs, {
  type CategoryDemandBlock,
  type CategoryDemandRow,
  type YearSalesSlice,
} from "./CategoriesTabs";
import { parseShopFilter, type ShopFilter } from "@/lib/shopFilter";
import CategoriesShopSelect from "./CategoriesShopSelect";

export const dynamic = "force-dynamic";

type SearchParams =
  | Promise<{ year?: string; shop?: string }>
  | { year?: string; shop?: string };

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

/**
 * Opatra blocks on the Products table: each label must match **Category** in Airtable
 * (case-insensitive). PYT categories use different Category values on the PYT Products table.
 */
const OPATRA_CATEGORY_BLOCKS: {
  id: string;
  label: string;
  description: string;
  hideStockRunoutColumns?: boolean;
}[] = [
  {
    id: "opatra-basic-skin-care",
    label: "Basic Skin Care",
    description: "Peeling gel, scrub, butter.",
  },
  {
    id: "opatra-skin-essential-line",
    label: "Skin Essential Line",
    description: "Reverse 5, caviar mask, caviar defense cream.",
  },
  {
    id: "opatra-skin-fab-line",
    label: "Skin Fab Line",
    description:
      "Collagen day cream, collagen serum, collagen night cream, lift eye serum, reverse eye cream.",
  },
  {
    id: "opatra-devices",
    label: "Devices",
    description:
      "Dermieye Plus, Lumiquartz, Dermineck, Dermisonic 2, Synergy Marble.",
  },
  {
    id: "opatra-synergy-line",
    label: "Synergy Line",
    description: "Synergy Eye, Synergy Face, Synergy Neck.",
  },
  {
    id: "opatra-other",
    label: "Other",
    description:
      "Other Opatra SKUs with Category = Other in Airtable.",
  },
  {
    id: "opatra-combo",
    label: "Combo",
    description:
      "Opatra bundle / combo products — set Category to Combo in Airtable on those rows.",
    hideStockRunoutColumns: true,
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

function getDisplayShop(sp: SearchParams): Promise<ShopFilter> {
  if (
    sp !== null &&
    typeof sp === "object" &&
    "then" in sp &&
    typeof (sp as Promise<{ shop?: string }>).then === "function"
  ) {
    return (sp as Promise<{ shop?: string }>).then((p) =>
      parseShopFilter(p.shop)
    );
  }
  return Promise.resolve(parseShopFilter((sp as { shop?: string })?.shop));
}

export default async function CategoriesPage(props: { searchParams?: SearchParams }) {
  const [year, shop] = await Promise.all([
    getDisplayYear(props.searchParams ?? {}),
    getDisplayShop(props.searchParams ?? {}),
  ]);
  const histYears = monthlyHistoryYearsUpTo(year);

  const products = await fetchProducts();

  const breakdownByYear = new Map<number, Map<string, number[]>>();
  for (const y of histYears) {
    breakdownByYear.set(y, await fetchDemandBreakdownForYear(y));
  }

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

  function isOpatraBrand(p: ProductRecord): boolean {
    return (p.brand ?? "").toLowerCase().includes("opatra");
  }

  /** Category from Airtable for Opatra (Products table). */
  function opatraDemandGroupLabel(p: ProductRecord): string | null {
    if (!isOpatraBrand(p)) return null;
    const c = (p.category ?? "").trim();
    return c || null;
  }

  function opatraProductsForBlockLabel(blockLabel: string): ProductRecord[] {
    const want = blockLabel.trim().toLowerCase();
    return products.filter((p) => {
      const g = opatraDemandGroupLabel(p);
      return g != null && g.trim().toLowerCase() === want;
    });
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

  function demandBlockForItems(
    id: string,
    label: string,
    description: string,
    items: ProductRecord[],
    opts?: { hideStockRunoutColumns?: boolean }
  ): CategoryDemandBlock | null {
    if (items.length === 0) return null;

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

    return {
      id,
      label,
      description,
      primaryYear: year,
      totalsByYear,
      totalCurrentStock,
      totalIncomingStock,
      totalDailyDemand,
      avgLeadTime,
      items: rows,
      hideStockRunoutColumns: opts?.hideStockRunoutColumns,
    };
  }

  const blocks: CategoryDemandBlock[] = [];

  for (const cat of CATEGORY_CONFIG) {
    const b = demandBlockForItems(
      cat.id,
      cat.label,
      cat.description,
      productsInCategory(cat.id)
    );
    if (b) blocks.push(b);
  }

  for (const cat of OPATRA_CATEGORY_BLOCKS) {
    const b = demandBlockForItems(
      cat.id,
      cat.label,
      cat.description,
      opatraProductsForBlockLabel(cat.label),
      cat.hideStockRunoutColumns
        ? { hideStockRunoutColumns: true }
        : undefined
    );
    if (b) blocks.push(b);
  }

  const filteredBlocks =
    shop === "all"
      ? blocks
      : shop === "pyt"
        ? blocks.filter((b) => !b.id.startsWith("opatra-"))
        : blocks.filter((b) => b.id.startsWith("opatra-"));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Category demand overview</h1>
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

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <CategoriesShopSelect year={year} shop={shop} />
              <span className="text-slate-600 hidden sm:inline">|</span>
              <span className="text-slate-400">Year:</span>
              {SUPPORTED_YEARS.map((y) => {
                const params = new URLSearchParams();
                params.set("year", String(y));
                if (shop !== "all") params.set("shop", shop);
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

        {filteredBlocks.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-6 text-sm text-slate-400">
            No category demand groups match this shop filter.
          </p>
        ) : (
          <CategoriesTabs
            primaryYear={year}
            historyYearsAsc={histYears}
            daysInYearByYear={daysInYearByYear}
            blocks={filteredBlocks}
          />
        )}
      </div>
    </main>
  );
}
