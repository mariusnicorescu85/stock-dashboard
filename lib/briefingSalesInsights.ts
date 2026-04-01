import type { ProductRecord } from "./airtable";
import { formatReorderTotalsEurUsd } from "./money";
import type { BriefingTopReorder, StockBriefing } from "./stockBriefing";
import { individualsOnly } from "./stockBriefing";
import {
  productMatchesShopFilter,
  shopFilterLabel,
  type ShopFilter,
} from "./shopFilter";

/** Calendar month for “today” (visit in March → March, etc.). */
export function briefingSameMonthWindow(now = new Date()): {
  month: number;
  monthLabel: string;
} {
  const y = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthLabel = new Date(y, month - 1, 1).toLocaleDateString("en-GB", { month: "long" });
  return { month, monthLabel };
}

function unitsForProduct(map: Map<string, number>, name: string): number {
  const trimmed = name.trim();
  if (!trimmed) return 0;
  if (map.has(trimmed)) return map.get(trimmed)!;
  const lower = trimmed.toLowerCase();
  for (const [k, v] of map.entries()) {
    if (k.trim().toLowerCase() === lower) return v;
  }
  return 0;
}

function productYearSeriesForMonth(
  demandByYear: Map<number, Map<string, number>>,
  productName: string
): Array<{ year: number; units: number }> {
  const years = [...demandByYear.keys()].sort((a, b) => a - b);
  const rows: Array<{ year: number; units: number }> = [];
  for (const y of years) {
    const inner = demandByYear.get(y);
    if (!inner) continue;
    const u = unitsForProduct(inner, productName);
    if (u > 0) rows.push({ year: y, units: u });
  }
  return rows;
}

function trendBetweenLastTwoRecordedYears(
  series: Array<{ year: number; units: number }>
): string {
  if (series.length === 0) return "";
  if (series.length === 1) {
    return `We only have sales in ${series[0].year} for this month in your records.`;
  }
  const prev = series[series.length - 2];
  const last = series[series.length - 1];
  const u1 = prev.units;
  const u2 = last.units;

  if (u1 <= 0 && u2 <= 0) return "";
  if (u1 <= 0 && u2 > 0) {
    return `${last.year} sold ${u2.toLocaleString("en-GB")} units; we have no sales for ${prev.year} to compare — no percentage change.`;
  }
  const pct = ((u2 - u1) / u1) * 100;
  const abs = Math.abs(pct);
  if (abs < 0.05) {
    return `${prev.year} and ${last.year} are about the same (${u1.toLocaleString("en-GB")} vs ${u2.toLocaleString("en-GB")} units).`;
  }
  const dir = pct > 0 ? "Up" : "Down";
  return `${dir} about ${abs.toFixed(1)}% from ${prev.year} (${u1.toLocaleString("en-GB")} units) to ${last.year} (${u2.toLocaleString("en-GB")}).`;
}

export const BRIEFING_TOP_PRODUCTS = 3;

export type BriefingRankedMonthProduct = {
  rank: number;
  productName: string;
  totalUnitsAllYears: number;
  yearSeries: Array<{ year: number; units: number }>;
  trendSummary: string;
};

export type BriefingShopSalesBlock = {
  shopKey: "opatra" | "pyt";
  shopLabel: string;
  topProducts: BriefingRankedMonthProduct[];
};

function topProductsBlockForShop(
  allProducts: ProductRecord[],
  shop: "opatra" | "pyt",
  demandByYear: Map<number, Map<string, number>>,
  limit: number
): BriefingShopSalesBlock | null {
  const pool = individualsOnly(allProducts).filter((p) =>
    productMatchesShopFilter(p, shop)
  );
  if (pool.length === 0) return null;

  const scored = pool
    .map((p) => {
      const yearSeries = productYearSeriesForMonth(demandByYear, p.name);
      const totalUnitsAllYears = yearSeries.reduce((s, x) => s + x.units, 0);
      return { p, yearSeries, totalUnitsAllYears };
    })
    .filter((x) => x.totalUnitsAllYears > 0)
    .sort((a, b) => {
      if (b.totalUnitsAllYears !== a.totalUnitsAllYears) {
        return b.totalUnitsAllYears - a.totalUnitsAllYears;
      }
      return a.p.name.localeCompare(b.p.name);
    })
    .slice(0, limit);

  if (scored.length === 0) return null;

  const topProducts: BriefingRankedMonthProduct[] = scored.map((row, i) => ({
    rank: i + 1,
    productName: row.p.name,
    totalUnitsAllYears: row.totalUnitsAllYears,
    yearSeries: row.yearSeries,
    trendSummary: trendBetweenLastTwoRecordedYears(row.yearSeries),
  }));

  return {
    shopKey: shop,
    shopLabel: shopFilterLabel(shop),
    topProducts,
  };
}

function reorderRowMatchesShop(r: BriefingTopReorder, shop: ShopFilter): boolean {
  if (shop === "all") return true;
  const brand = r.brand ?? "";
  if (shop === "pyt") return brand.toLowerCase().includes("pyt");
  if (shop === "opatra") return brand.includes("Opatra");
  return true;
}

export function buildReorderGuidance(briefing: StockBriefing, shop: ShopFilter): string {
  const rows = briefing.topReorders.filter((r) => reorderRowMatchesShop(r, shop));
  if (rows.length === 0) {
    return shop === "all"
      ? "Nothing is on the buying list today — at today’s sales pace you shouldn’t run out unexpectedly."
      : `No ${shopFilterLabel(shop)} products need ordering right now — stock looks comfortable for how fast things are selling.`;
  }

  const units = rows.reduce((s, r) => s + r.qtyToOrder, 0);
  const critical = rows.filter(
    (r) => r.daysUntilRunOut != null && r.daysUntilRunOut <= 14
  ).length;

  const topNames = rows.slice(0, 4).map((r) => r.name);
  const more = rows.length > 4 ? `, and ${rows.length - 4} more` : "";

  let lead = `You’ll want to buy about ${units.toLocaleString(
    "en-GB"
  )} units across ${rows.length} products for this view — good to start with ${topNames.join(", ")}${more}.`;

  if (critical > 0) {
    lead += ` ${critical} of them are down to about two weeks of stock or less, so they’re urgent.`;
  }

  if (briefing.reorderOrderValueEur > 0 || briefing.reorderOrderValueUsd > 0) {
    lead += ` Known line values in supplier currency (no £ conversion): ${formatReorderTotalsEurUsd(
      briefing.reorderOrderValueEur,
      briefing.reorderOrderValueUsd
    )}`;
    if (briefing.reorderSkusWithoutUnitPrice > 0) {
      lead += ` (${briefing.reorderSkusWithoutUnitPrice} line${briefing.reorderSkusWithoutUnitPrice !== 1 ? "s" : ""} still missing a price)`;
    }
    lead += ".";
  }

  return lead;
}

export type BriefingSalesNarrative = {
  month: number;
  monthLabel: string;
  /** Calendar years that have any monthly sales rows for this month (across both tables). */
  yearsPresent: number[];
  shopBlocks: BriefingShopSalesBlock[];
  reorderGuidance: string;
};

export function buildBriefingSalesNarrative(input: {
  allProducts: ProductRecord[];
  briefing: StockBriefing;
  shop: ShopFilter;
  demandByYear: Map<number, Map<string, number>>;
  month: number;
  monthLabel: string;
}): BriefingSalesNarrative {
  const { allProducts, briefing, shop, demandByYear, month, monthLabel } = input;

  const yearsPresent = [...demandByYear.keys()].sort((a, b) => a - b);

  const shopBlocks: BriefingShopSalesBlock[] = [];

  const wantOpatra = shop === "opatra" || shop === "all";
  const wantPyt = shop === "pyt" || shop === "all";

  if (wantOpatra) {
    const b = topProductsBlockForShop(allProducts, "opatra", demandByYear, BRIEFING_TOP_PRODUCTS);
    if (b) shopBlocks.push(b);
  }
  if (wantPyt) {
    const b = topProductsBlockForShop(allProducts, "pyt", demandByYear, BRIEFING_TOP_PRODUCTS);
    if (b) shopBlocks.push(b);
  }

  return {
    month,
    monthLabel,
    yearsPresent,
    shopBlocks,
    reorderGuidance: buildReorderGuidance(briefing, shop),
  };
}
