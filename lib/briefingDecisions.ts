import type { BriefingSalesNarrative } from "./briefingSalesInsights";
import type { ProductRecord } from "./airtable";
import { reorderRowIsBriefingSnoozed } from "./briefingProductSignals";
import type { BriefingTopReorder, StockBriefing } from "./stockBriefing";
import { shopFilterLabel, supplierLeadDaysForBrand, type ShopFilter } from "./shopFilter";

export type BriefingDecisionSeverity = "critical" | "high" | "medium" | "low";

export type BriefingDecision = {
  id: string;
  severity: BriefingDecisionSeverity;
  title: string;
  rationale: string[];
  suggestedActions: string[];
  relatedProductNames?: string[];
};

const SEVERITY_ORDER: Record<BriefingDecisionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Buying-list rows visible for the selected shop filter (same rules as the briefing table). */
export function briefingTopReordersForShop(
  rows: BriefingTopReorder[],
  shop: ShopFilter
): BriefingTopReorder[] {
  if (shop === "all") return rows;
  return rows.filter((r) => {
    const brand = r.brand ?? "";
    if (shop === "pyt") return brand.toLowerCase().includes("pyt");
    if (shop === "opatra") return brand.includes("Opatra");
    return true;
  });
}

function productForReorderLine(
  scopedProducts: ProductRecord[],
  r: BriefingTopReorder
): ProductRecord | undefined {
  return (
    scopedProducts.find((p) => p.id === r.id) ??
    scopedProducts.find((p) => p.name.trim().toLowerCase() === r.name.trim().toLowerCase())
  );
}

/** PYT / Opatra use fixed supplier lead; other brands fall back to Airtable “Lead Time” on the product. */
function effectiveSupplierLeadDays(
  r: BriefingTopReorder,
  p: ProductRecord | undefined
): number | null {
  const fromShop = supplierLeadDaysForBrand(r.brand ?? p?.brand);
  if (fromShop != null) return fromShop;
  return p?.leadTimeDays ?? null;
}

function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Last two data points in the year series: negative = demand softening for that month window. */
function lastTwoYearTrendPct(
  series: Array<{ year: number; units: number }>
): number | null {
  if (series.length < 2) return null;
  const prev = series[series.length - 2].units;
  const last = series[series.length - 1].units;
  if (prev <= 0) return null;
  return ((last - prev) / prev) * 100;
}

export function buildBriefingDecisions(input: {
  briefing: StockBriefing;
  scopedProducts: ProductRecord[];
  salesNarrative: BriefingSalesNarrative;
  shop: ShopFilter;
}): BriefingDecision[] {
  const { briefing, scopedProducts, salesNarrative, shop } = input;
  const queue = briefingTopReordersForShop(briefing.topReorders, shop);
  const scopeLabel = shopFilterLabel(shop);
  const snoozedOnBuyingList = queue.filter((r) =>
    reorderRowIsBriefingSnoozed(r, briefing.todayYmd)
  ).length;

  const out: BriefingDecision[] = [];

  if (briefing.critical0to7 > 0) {
    out.push({
      id: "runway-critical-0-7",
      severity: "critical",
      title: `${briefing.critical0to7} products in ${scopeLabel} could run out within about a week`,
      rationale: [
        `For the view you selected (${scopeLabel}), ${briefing.critical0to7} products are very low on stock at today’s sales pace.`,
        briefing.reorderSkuCount > 0
          ? `${queue.length} products on your buying list for this view — start with the ones whose order dates are oldest or already passed.`
          : "If you expected more lines here, check that products aren’t marked “no reorder” in your stock sheet.",
        ...(snoozedOnBuyingList > 0
          ? [
              `${snoozedOnBuyingList} product(s) on this list have a briefing snooze date in Airtable — they still appear in the table; line-level alerts skip them until that date.`,
            ]
          : []),
      ],
      suggestedActions: [
        "Order or chase delivery for these products first.",
        "Check any orders you’ve already placed and when they’re due in.",
      ],
    });
  }

  if (briefing.reorderQueueHasOverdueOrderBy && queue.length > 0) {
    out.push({
      id: "queue-overdue-order-by",
      severity: "high",
      title: "Some products should already have been ordered",
      rationale: [
        "At least one product has a suggested order date before today — so you’re behind the ideal buying schedule for those lines.",
        `You’re looking at ${queue.length} products on the buying list for ${scopeLabel}.`,
      ],
      suggestedActions: [
        "Place or chase orders for those past-due lines before anything else.",
        "If lots of products share the same date, delivery time and demand may have shifted together — worth a quick sense-check in your sheet.",
      ],
    });
  }

  const leadGapNames = queue
    .map((r) => {
      if (reorderRowIsBriefingSnoozed(r, briefing.todayYmd)) return null;
      const p = productForReorderLine(scopedProducts, r);
      const lead = effectiveSupplierLeadDays(r, p);
      if (lead == null || r.daysUntilRunOut == null) return null;
      if (r.daysUntilRunOut < lead && r.qtyToOrder > 0) return r.name;
      return null;
    })
    .filter((x): x is string => x != null);

  if (leadGapNames.length > 0) {
    const unique = [...new Set(leadGapNames)];
    out.push({
      id: "runway-under-lead",
      severity: "high",
      title: "Stock may run out before new delivery arrives",
      rationale: [
        `For ${unique.length} product(s), stock left is shorter than typical supplier delivery time, but you still need to order — you could go out of stock unless delivery is fast-tracked or you split an order.`,
        "We assume about 60 days’ delivery for PYT Hairstyle and 14 days for Opatra; other brands use the lead time saved on each product if you have one.",
      ],
      suggestedActions: [
        "Ask suppliers if anything can be sent faster or in two shipments.",
        "Once you’re back in balance, consider holding a little extra on these lines if delays are common.",
      ],
      relatedProductNames: unique.slice(0, 12),
    });
  }

  const heroRisk: { name: string; shopLabel: string; days: number | null; overdue: boolean }[] =
    [];
  for (const block of salesNarrative.shopBlocks) {
    for (const tp of block.topProducts) {
      const row = queue.find((r) => namesMatch(r.name, tp.productName));
      if (!row) continue;
      if (reorderRowIsBriefingSnoozed(row, briefing.todayYmd)) continue;
      const overdue = !!(row.orderByDate && row.orderByDate < briefing.todayYmd);
      const days = row.daysUntilRunOut;
      const tight = overdue || (days != null && days <= 14);
      if (tight) {
        heroRisk.push({
          name: tp.productName,
          shopLabel: block.shopLabel,
          days,
          overdue,
        });
      }
    }
  }

  if (heroRisk.length > 0) {
    const anySevere = heroRisk.some((h) => h.overdue || (h.days != null && h.days <= 7));
    out.push({
      id: "hero-seller-stock-risk",
      severity: anySevere ? "high" : "medium",
      title: "Big sellers are also low on stock — double risk",
      rationale: [
        `${heroRisk.length} of your best sellers in ${salesNarrative.monthLabel} (by shop) are on the buying list or running low — it hurts more when these go out of stock.`,
        ...heroRisk.slice(0, 5).map((h) =>
          h.overdue
            ? `${h.name} (${h.shopLabel}): order date already passed.`
            : `${h.name} (${h.shopLabel}): only about ${h.days != null ? Math.round(h.days) : "—"} days of stock left.`
        ),
      ],
      suggestedActions: [
        "Prioritise getting stock in for these names before quieter lines.",
        "If any are on offer or ads, check arrivals match what you’ve promised customers.",
      ],
      relatedProductNames: [...new Set(heroRisk.map((h) => h.name))],
    });
  }

  for (const block of salesNarrative.shopBlocks) {
    const top = block.topProducts.find((p) => p.rank === 1);
    if (!top) continue;
    const pct = lastTwoYearTrendPct(top.yearSeries);
    if (pct != null && pct <= -10) {
      out.push({
        id: `hero-soft-demand-${block.shopKey}`,
        severity: "medium",
        title: `${block.shopLabel}: your top ${salesNarrative.monthLabel} product is selling less than before`,
        rationale: [
          `For ${top.productName}, sales in ${salesNarrative.monthLabel} are down about ${Math.abs(Math.round(pct))}% between the last two years we have on record — you may not need to buy as aggressively as in the past.`,
        ],
        suggestedActions: [
          "Sense-check against the last few weeks in the shop, not only history.",
          "Consider smaller orders until you’re sure demand has picked up again.",
        ],
        relatedProductNames: [top.productName],
      });
    }
  }

  if (queue.length >= 15) {
    out.push({
      id: "large-reorder-queue",
      severity: "medium",
      title: `A long buying list (${queue.length} products) — work it in order`,
      rationale: [
        `Roughly ${briefing.totalUnitsToOrder.toLocaleString("en-GB")} units to buy in this view — tackle the urgent ones first so nothing important is missed.`,
      ],
      suggestedActions: [
        "Start with past-due and “under a week” stock, then one-to-two weeks, then the rest.",
        "Group orders by supplier where it saves time or meets minimum order sizes.",
      ],
    });
  }

  if (queue.length > 0 && out.length === 0) {
    out.push({
      id: "reorder-queue-review",
      severity: "medium",
      title: `${queue.length} products on your buying list for ${scopeLabel}`,
      rationale: [
        "The numbers are a guide from your stock and sales data — double-check dates and supplier rules before you order.",
        `About ${briefing.totalUnitsToOrder.toLocaleString("en-GB")} units in total for this view.`,
      ],
      suggestedActions: [
        "Work from most urgent (late or low stock) to least.",
        "Combine lines from the same supplier where it saves money or hassle.",
      ],
    });
  }

  if (out.length === 0 && queue.length === 0) {
    out.push({
      id: "no-reorders-scope",
      severity: "low",
      title: `Nothing needs buying right now for ${scopeLabel}`,
      rationale: [
        "For this shop view, stock levels look enough for current sales — nothing is flagged to order today.",
      ],
      suggestedActions: [
        "Check again after your stock or sales figures update.",
        "Try “All shops” if you thought you’d see more when one shop is selected.",
      ],
    });
  }

  return [...out].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
