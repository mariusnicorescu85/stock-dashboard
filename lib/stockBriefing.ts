import type { ProductRecord } from "./airtable";
import { dateToYmd } from "./calendar";
import {
  formatMoney,
  formatReorderTotalsEurUsd,
  type PurchaseCurrency,
} from "./money";

export type BriefingTopReorder = {
  id: string;
  name: string;
  brand?: string;
  qtyToOrder: number;
  orderByDate: string | null;
  daysUntilRunOut: number | null;
  currentStock: number;
  /** Buy / unit cost when set in Airtable (amounts in `purchaseCurrency`). */
  pricePerUnit: number | null;
  purchaseCurrency: PurchaseCurrency;
  briefingSnoozeUntil?: string | null;
  briefingOrderedAt?: string | null;
  /** Airtable table name for PATCH (Products vs PYT Products). */
  airtableTable?: string;
};

export type StockBriefing = {
  /** en-GB long date for “today” in the app’s default locale sense */
  dateLabel: string;
  /** Calendar “today” as YYYY-MM-DD (server TZ). */
  todayYmd: string;
  critical0to7: number;
  urgent8to14: number;
  watch15to30: number;
  planning31to60: number;
  reorderSkuCount: number;
  totalUnitsToOrder: number;
  /** Raw model date: first in queue when sorted by urgency (often in the past). */
  soonestOrderByIso: string | null;
  /** Any reorder row has model order-by strictly before `todayYmd`. */
  reorderQueueHasOverdueOrderBy: boolean;
  /** Smallest model order-by that is still ≥ today; null if every line is overdue. */
  soonestFutureOrderByIso: string | null;
  /** Every individual SKU with qty to order, sorted by order-by date. */
  topReorders: BriefingTopReorder[];
  /**
   * Sum of line values for Opatra (and other non-PYT) SKUs with unit prices — EUR, not converted to £.
   */
  reorderOrderValueEur: number;
  /**
   * Sum of line values for PYT SKUs with unit prices — USD, not converted to £.
   */
  reorderOrderValueUsd: number;
  /** Reorder queue lines with qty &gt; 0 but no unit price in Airtable. */
  reorderSkusWithoutUnitPrice: number;
};

export function individualsOnly(products: ProductRecord[]) {
  return products.filter((p) => p.productType === "Individual");
}

function parseOrderByMs(p: ProductRecord): number {
  if (!p.orderByDate) return Infinity;
  const t = new Date(p.orderByDate).getTime();
  return Number.isNaN(t) ? Infinity : t;
}

function mapToReorderLines(sorted: ProductRecord[]): BriefingTopReorder[] {
  return sorted.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    qtyToOrder: p.qtyToOrder,
    orderByDate: p.orderByDate,
    daysUntilRunOut: p.daysUntilRunOut,
    currentStock: p.currentStock,
    pricePerUnit: p.pricePerUnit,
    purchaseCurrency: p.purchaseCurrency,
    briefingSnoozeUntil: p.briefingSnoozeUntil,
    briefingOrderedAt: p.briefingOrderedAt,
    airtableTable: p.airtableTable,
  }));
}

/** Runway buckets for the next 60 days — same rules as the main dashboard. */
export function partitionRunoutBuckets(products: ProductRecord[]) {
  const individuals = individualsOnly(products);
  const active = individuals.filter((p) => !p.excludeFromReorder);

  const runningOut0to7 = active.filter(
    (p) => p.daysUntilRunOut != null && p.daysUntilRunOut >= 0 && p.daysUntilRunOut <= 7
  );
  const runningOut8to14 = active.filter(
    (p) => p.daysUntilRunOut != null && p.daysUntilRunOut > 7 && p.daysUntilRunOut <= 14
  );
  const runningOut15to30 = active.filter(
    (p) => p.daysUntilRunOut != null && p.daysUntilRunOut > 14 && p.daysUntilRunOut <= 30
  );
  const runningOut31to60 = active.filter(
    (p) => p.daysUntilRunOut != null && p.daysUntilRunOut > 30 && p.daysUntilRunOut <= 60
  );

  const needingOrder = individuals.filter(
    (p) => p.qtyToOrder > 0 && !p.excludeFromReorder
  );

  return {
    individuals,
    runningOut0to7,
    runningOut8to14,
    runningOut15to30,
    runningOut31to60,
    needingOrder,
  };
}

export type RunoutBuckets = ReturnType<typeof partitionRunoutBuckets>;

/**
 * Summary for “today” card and cron email (reuse one `partitionRunoutBuckets` call on the page).
 */
export function buildStockBriefingFromBuckets(buckets: RunoutBuckets): StockBriefing {
  const {
    runningOut0to7,
    runningOut8to14,
    runningOut15to30,
    runningOut31to60,
    needingOrder,
  } = buckets;

  const totalUnitsToOrder = needingOrder.reduce((sum, p) => sum + p.qtyToOrder, 0);

  const byOrderBy = [...needingOrder].sort(
    (a, b) => parseOrderByMs(a) - parseOrderByMs(b)
  );
  let soonestOrderByIso: string | null = null;
  for (const p of byOrderBy) {
    if (p.orderByDate) {
      soonestOrderByIso = p.orderByDate;
      break;
    }
  }

  const topReorders = mapToReorderLines(byOrderBy);

  let reorderOrderValueEur = 0;
  let reorderOrderValueUsd = 0;
  let reorderSkusWithoutUnitPrice = 0;
  for (const p of needingOrder) {
    if (p.qtyToOrder <= 0) continue;
    if (p.pricePerUnit != null && Number.isFinite(p.pricePerUnit)) {
      const line = p.qtyToOrder * p.pricePerUnit;
      if (p.purchaseCurrency === "USD") reorderOrderValueUsd += line;
      else reorderOrderValueEur += line;
    } else {
      reorderSkusWithoutUnitPrice += 1;
    }
  }

  const today = new Date();
  const todayYmd = dateToYmd(today);
  const dateLabel = today.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let reorderQueueHasOverdueOrderBy = false;
  let soonestFutureOrderByIso: string | null = null;
  for (const p of needingOrder) {
    if (!p.orderByDate) continue;
    if (p.orderByDate < todayYmd) reorderQueueHasOverdueOrderBy = true;
    else if (!soonestFutureOrderByIso || p.orderByDate < soonestFutureOrderByIso) {
      soonestFutureOrderByIso = p.orderByDate;
    }
  }

  return {
    dateLabel,
    todayYmd,
    critical0to7: runningOut0to7.length,
    urgent8to14: runningOut8to14.length,
    watch15to30: runningOut15to30.length,
    planning31to60: runningOut31to60.length,
    reorderSkuCount: needingOrder.length,
    totalUnitsToOrder,
    soonestOrderByIso,
    reorderQueueHasOverdueOrderBy,
    soonestFutureOrderByIso,
    topReorders,
    reorderOrderValueEur,
    reorderOrderValueUsd,
    reorderSkusWithoutUnitPrice,
  };
}

export function buildStockBriefing(products: ProductRecord[]): StockBriefing {
  return buildStockBriefingFromBuckets(partitionRunoutBuckets(products));
}

function ymdToEnGB(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function formatBriefingOrderByLine(
  orderByIso: string | null,
  todayYmd: string
): string {
  if (!orderByIso) return "—";
  if (orderByIso < todayYmd) {
    return `Overdue (model ${ymdToEnGB(orderByIso)})`;
  }
  return ymdToEnGB(orderByIso);
}

export function briefingEmailText(
  briefing: StockBriefing,
  dashboardUrl: string
): { subject: string; text: string; html: string } {
  const subject =
    briefing.reorderSkuCount > 0 || briefing.critical0to7 > 0
      ? `Stock: ${briefing.reorderSkuCount} SKU(s) to reorder · ${briefing.critical0to7} critical`
      : "Stock: no reorders due (briefing)";

  const soonestSummary = briefing.reorderQueueHasOverdueOrderBy
    ? briefing.soonestFutureOrderByIso
      ? `Queue includes overdue lines; next upcoming model order-by: ${ymdToEnGB(briefing.soonestFutureOrderByIso)}`
      : `Queue: all lines overdue (model order-by before ${ymdToEnGB(briefing.todayYmd)})`
    : briefing.soonestFutureOrderByIso
      ? `Soonest model order-by: ${ymdToEnGB(briefing.soonestFutureOrderByIso)}`
      : "Soonest model order-by: —";

  const lines: string[] = [
    `Briefing for ${briefing.dateLabel}`,
    "",
    `Running low (60d buckets): 0–7d: ${briefing.critical0to7} · 8–14d: ${briefing.urgent8to14} · 15–30d: ${briefing.watch15to30} · 31–60d: ${briefing.planning31to60}`,
    `Reorder queue: ${briefing.reorderSkuCount} SKU(s) · ${briefing.totalUnitsToOrder} units total`,
    soonestSummary,
  ];

  if (briefing.reorderOrderValueEur > 0 || briefing.reorderOrderValueUsd > 0) {
    lines.push(
      `Estimated order value (supplier currency, no £ conversion): ${formatReorderTotalsEurUsd(
        briefing.reorderOrderValueEur,
        briefing.reorderOrderValueUsd
      )}`
    );
    if (briefing.reorderSkusWithoutUnitPrice > 0) {
      lines.push(
        `  (${briefing.reorderSkusWithoutUnitPrice} SKU(s) missing unit price — totals incomplete)`
      );
    }
  }

  lines.push("", "Full reorder queue (model order-by; Overdue = before today):");

  if (briefing.topReorders.length === 0) {
    lines.push("  (none)");
  } else {
    for (const r of briefing.topReorders) {
      const by = formatBriefingOrderByLine(r.orderByDate, briefing.todayYmd);
      const days =
        r.daysUntilRunOut != null ? `${Math.round(r.daysUntilRunOut)}d runway` : "—";
      const lineMoney =
        r.pricePerUnit != null
          ? ` · line ${formatMoney(r.qtyToOrder * r.pricePerUnit, r.purchaseCurrency)} (${formatMoney(r.pricePerUnit, r.purchaseCurrency)} ea)`
          : "";
      lines.push(
        `  • ${r.name}${r.brand ? ` (${r.brand})` : ""} — order ${r.qtyToOrder} pcs · ${by} · ${days} left · stock ${r.currentStock}${lineMoney}`
      );
    }
  }

  lines.push("", `Open dashboard: ${dashboardUrl}`);

  const text = lines.join("\n");

  const rows =
    briefing.topReorders.length === 0
      ? "<tr><td colspan='7' style='padding:8px'>No SKUs in reorder queue.</td></tr>"
      : briefing.topReorders
          .map((r) => {
            const unitH =
              r.pricePerUnit != null
                ? escapeHtml(formatMoney(r.pricePerUnit, r.purchaseCurrency))
                : "—";
            const lineH =
              r.pricePerUnit != null
                ? escapeHtml(formatMoney(r.qtyToOrder * r.pricePerUnit, r.purchaseCurrency))
                : "—";
            return (
              `<tr><td style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(r.name)}</td>` +
              `<td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${r.qtyToOrder}</td>` +
              `<td style="padding:6px;border-bottom:1px solid #eee">${unitH}</td>` +
              `<td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${lineH}</td>` +
              `<td style="padding:6px;border-bottom:1px solid #eee">${escapeHtml(formatBriefingOrderByLine(r.orderByDate, briefing.todayYmd))}</td>` +
              `<td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${r.daysUntilRunOut != null ? Math.round(r.daysUntilRunOut) : "—"}</td>` +
              `<td style="padding:6px;border-bottom:1px solid #eee;text-align:right">${r.currentStock}</td></tr>`
            );
          })
          .join("");

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#111">
<p><strong>${escapeHtml(briefing.dateLabel)}</strong></p>
<ul style="margin:0 0 16px;padding-left:20px">
<li>0–7 days high risk: <strong>${briefing.critical0to7}</strong></li>
<li>8–14 days: <strong>${briefing.urgent8to14}</strong></li>
<li>15–30 days: <strong>${briefing.watch15to30}</strong></li>
<li>31–60 days: <strong>${briefing.planning31to60}</strong></li>
<li>Reorder queue: <strong>${briefing.reorderSkuCount}</strong> SKU(s), <strong>${briefing.totalUnitsToOrder}</strong> units</li>
${
  briefing.reorderOrderValueEur > 0 || briefing.reorderOrderValueUsd > 0
    ? `<li>Estimated order value (supplier currency, not £): <strong>${escapeHtml(
        formatReorderTotalsEurUsd(
          briefing.reorderOrderValueEur,
          briefing.reorderOrderValueUsd
        )
      )}</strong>${
        briefing.reorderSkusWithoutUnitPrice > 0
          ? ` — <span style="color:#666">${briefing.reorderSkusWithoutUnitPrice} SKU(s) missing price (incomplete)</span>`
          : ""
      }</li>`
    : ""
}
<li><strong>${escapeHtml(soonestSummary)}</strong></li>
</ul>
<table style="border-collapse:collapse;width:100%;max-width:720px;font-size:14px">
<thead><tr style="text-align:left;border-bottom:2px solid #ccc">
<th style="padding:6px">Product</th><th style="padding:6px;text-align:right">Qty</th>
<th style="padding:6px;text-align:right">Unit</th><th style="padding:6px;text-align:right">Line</th>
<th style="padding:6px">Model order-by</th><th style="padding:6px;text-align:right">Days left</th><th style="padding:6px;text-align:right">Stock</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
<p style="margin-top:20px"><a href="${escapeHtml(dashboardUrl)}">Open dashboard</a></p>
</body></html>`;

  return { subject, text, html };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
