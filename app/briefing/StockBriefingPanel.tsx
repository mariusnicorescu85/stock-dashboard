import Link from "next/link";
import type { BriefingBaselineDelta } from "@/lib/briefingBaselineAirtable";
import type { BriefingDecision } from "@/lib/briefingDecisions";
import { briefingTopReordersForShop } from "@/lib/briefingDecisions";
import type { BriefingNarrationResult } from "@/lib/briefingNarrationOpenAI";
import { reorderRowIsBriefingSnoozed } from "@/lib/briefingProductSignals";
import type { BriefingSalesNarrative } from "@/lib/briefingSalesInsights";
import { formatMoneyOptional, formatReorderTotalsEurUsd } from "@/lib/money";
import type { BriefingTopReorder, StockBriefing } from "@/lib/stockBriefing";
import { shopFilterLabel, type ShopFilter } from "@/lib/shopFilter";
import AirtableBriefingTools from "./AirtableBriefingTools";
import BriefingDecisionsPanel from "./BriefingDecisionsPanel";
import BriefingNarrationCard from "./BriefingNarrationCard";
import BriefingNarrative from "./BriefingNarrative";
import BriefingProductSignalButtons from "./BriefingProductSignalButtons";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB");
}

function daysFromToday(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  if (Number.isNaN(target)) return null;

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();

  return Math.round((target - startOfToday) / 86_400_000);
}

function daysBadge(days: number | null) {
  if (days == null) return <span className="text-slate-400">—</span>;

  const clamped = Math.max(0, Math.round(days));
  let color = "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (clamped <= 7) color = "bg-red-500/15 text-red-300 border-red-500/30";
  else if (clamped <= 30)
    color = "bg-amber-500/15 text-amber-300 border-amber-500/30";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}
      title="Rough days left if sales stay at today’s pace"
    >
      {clamped}
    </span>
  );
}

function orderByClass(orderByDate: string | null) {
  const diff = daysFromToday(orderByDate);
  if (diff == null) return "text-slate-200";
  if (diff < 0) return "text-red-300";
  if (diff <= 7) return "text-amber-200";
  return "text-slate-200";
}

function briefingRowSignals(row: BriefingTopReorder, todayYmd: string) {
  const snoozed = reorderRowIsBriefingSnoozed(row, todayYmd);
  const ordered = row.briefingOrderedAt != null && row.briefingOrderedAt !== "";
  return { snoozed, ordered };
}

export default function StockBriefingPanel({
  briefing,
  shop,
  salesNarrative,
  decisions,
  aiNarration,
  baselineDelta,
}: {
  briefing: StockBriefing;
  shop: ShopFilter;
  salesNarrative: BriefingSalesNarrative;
  decisions: BriefingDecision[];
  aiNarration: BriefingNarrationResult | null;
  baselineDelta: BriefingBaselineDelta | null;
}) {
  const hasPressure =
    briefing.critical0to7 > 0 ||
    briefing.urgent8to14 > 0 ||
    briefing.reorderSkuCount > 0;

  const scope = shopFilterLabel(shop);
  const scopedQueue = briefingTopReordersForShop(briefing.topReorders, shop);
  const snoozedOnBuyingList = scopedQueue.filter((r) =>
    reorderRowIsBriefingSnoozed(r, briefing.todayYmd)
  ).length;

  return (
    <section
      className={`rounded-2xl border p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] space-y-4 ${
        hasPressure
          ? "border-amber-500/35 bg-gradient-to-br from-amber-500/[0.12] to-slate-900/60"
          : "border-slate-800/80 bg-slate-900/60"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Today&apos;s stock briefing</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            How much you have left, what to order, and which products sell best — from your live stock
            and sales data.
          </p>
          <p className="text-xs text-slate-500 mt-1">{briefing.dateLabel}</p>
          <p className="text-xs text-emerald-200/80 mt-1 font-medium">View: {scope}</p>
        </div>
        <Link
          href={shop === "all" ? "/buying-list" : `/buying-list?shop=${shop}`}
          className="shrink-0 inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500/90 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
        >
          Open buying list
        </Link>
      </div>

      <AirtableBriefingTools variant="compact" />

      {baselineDelta ? (
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/20 px-3 py-2.5 text-xs text-cyan-100/90 space-y-1.5">
          <p className="font-semibold text-cyan-200/95">
            Change since last Airtable snapshot ({formatDate(baselineDelta.previousSnapshotYmd)})
          </p>
          <ul className="list-disc pl-4 space-y-0.5 text-cyan-100/80">
            {baselineDelta.lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <p className="text-[10px] text-slate-500 pt-0.5">
            Snapshots update when the cron runs or when you use &quot;Save briefing snapshot&quot;
            above. Env:{' '}
            <code className="text-slate-400">AIRTABLE_BRIEFING_BASELINE_*</code>.
          </p>
        </div>
      ) : null}

      {snoozedOnBuyingList > 0 ? (
        <p className="text-[11px] text-violet-300/90">
          {snoozedOnBuyingList} line(s) have an active briefing snooze in Airtable — they stay visible;
          urgent hints skip them until the snooze date.
        </p>
      ) : null}

      <BriefingDecisionsPanel decisions={decisions} />

      {aiNarration ? <BriefingNarrationCard narration={aiNarration} /> : null}

      <BriefingNarrative narrative={salesNarrative} shop={shop} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-red-400/25 bg-red-500/5 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-red-200/80">
            Within a week of running out
          </p>
          <p className="mt-1 text-2xl font-semibold text-red-100">{briefing.critical0to7}</p>
          <p className="text-xs text-slate-500 mt-0.5">Products — needs attention first</p>
        </div>
        <div className="rounded-xl border border-amber-400/25 bg-amber-500/5 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-200/80">
            About 1–2 weeks of stock
          </p>
          <p className="mt-1 text-2xl font-semibold text-amber-100">{briefing.urgent8to14}</p>
          <p className="text-xs text-slate-500 mt-0.5">Products — plan orders soon</p>
        </div>
        <div className="rounded-xl border border-slate-600/40 bg-slate-800/40 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Buying list</p>
          <p className="mt-1 text-2xl font-semibold text-slate-50">
            {briefing.reorderSkuCount}{" "}
            <span className="text-base font-normal text-slate-400">products</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            ~{briefing.totalUnitsToOrder.toLocaleString("en-GB")} units suggested (based on stock
            and how fast things sell)
          </p>
          {briefing.reorderOrderValueEur > 0 || briefing.reorderOrderValueUsd > 0 ? (
            <p className="text-xs text-emerald-200/90 mt-1 font-medium tabular-nums">
              ~
              {formatReorderTotalsEurUsd(
                briefing.reorderOrderValueEur,
                briefing.reorderOrderValueUsd
              )}{" "}
              <span className="text-slate-500 font-normal">(supplier currency, not £)</span>
              {briefing.reorderSkusWithoutUnitPrice > 0 ? (
                <span className="text-slate-500 font-normal">
                  {" "}
                  (+{briefing.reorderSkusWithoutUnitPrice} SKU
                  {briefing.reorderSkusWithoutUnitPrice !== 1 ? "s" : ""} missing unit price)
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-200/80">
            Suggested order dates
          </p>
          {briefing.reorderSkuCount === 0 ? (
            <p className="mt-1 text-lg font-semibold text-slate-400">—</p>
          ) : briefing.reorderQueueHasOverdueOrderBy ? (
            <>
              <p className="mt-1 text-lg font-semibold text-amber-200">Some dates are already past</p>
              {briefing.soonestFutureOrderByIso ? (
                <p className="text-xs text-slate-400 mt-0.5">
                  Next target date from today: {formatDate(briefing.soonestFutureOrderByIso)}
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-0.5">
                  All suggested dates are before today — work the list from the oldest dates upward.
                </p>
              )}
            </>
          ) : (
            <p
              className={`mt-1 text-lg font-semibold ${orderByClass(briefing.soonestFutureOrderByIso)}`}
            >
              {formatDate(briefing.soonestFutureOrderByIso)}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-0.5">
            Allows time for delivery before you’d run out
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-800/80">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {`Buying list (${briefing.topReorders.length} product${
              briefing.topReorders.length === 1 ? "" : "s"
            })`}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Sorted by suggested order date (earliest first).{" "}
            <strong className="text-slate-400">Late</strong> means that date has already passed — treat
            those lines first. Several products may share one date when delivery time and stock line
            up. <strong className="text-slate-400">Days left</strong> is a rough “how long until empty”
            at today’s sales pace; it can still show a few days even when the order date is late, if
            delivery usually takes longer than that.
          </p>
        </div>
        {briefing.topReorders.length === 0 ? (
          <p className="px-3 py-6 text-sm text-slate-500 text-center">
            Nothing on the buying list for this view.
          </p>
        ) : (
          <div className="max-h-[min(70vh,56rem)] overflow-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-800/80">
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium text-right">Qty to order</th>
                  <th className="px-3 py-2 font-medium text-right hidden sm:table-cell">Unit</th>
                  <th className="px-3 py-2 font-medium text-right hidden sm:table-cell">Line</th>
                  <th
                    className="px-3 py-2 font-medium"
                    title="Ideal day to place the order so stock arrives before you run out."
                  >
                    Order by
                  </th>
                  <th className="px-3 py-2 font-medium text-right">Stock left (days)</th>
                  <th className="px-3 py-2 font-medium w-[6.5rem]">Airtable</th>
                </tr>
              </thead>
              <tbody>
                {briefing.topReorders.map((r) => {
                  const sig = briefingRowSignals(r, briefing.todayYmd);
                  return (
                  <tr key={r.id} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-3 py-2 text-slate-100">
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <span>{r.name}</span>
                        {sig.snoozed ? (
                          <span
                            className="rounded-md border border-violet-400/35 bg-violet-500/15 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-violet-200"
                            title={`Snoozed until ${formatDate(r.briefingSnoozeUntil ?? null)}`}
                          >
                            Snoozed
                          </span>
                        ) : null}
                        {sig.ordered ? (
                          <span
                            className="rounded-md border border-sky-400/30 bg-sky-500/10 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-sky-200/90"
                            title={`Reorder placed ${formatDate(r.briefingOrderedAt ?? null)}`}
                          >
                            Order placed
                          </span>
                        ) : null}
                      </span>
                      {r.brand ? (
                        <span className="block text-xs text-slate-500">{r.brand}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-200">{r.qtyToOrder}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-400 hidden sm:table-cell">
                      {formatMoneyOptional(r.pricePerUnit, r.purchaseCurrency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-200 hidden sm:table-cell">
                      {formatMoneyOptional(
                        r.pricePerUnit != null ? r.qtyToOrder * r.pricePerUnit : null,
                        r.purchaseCurrency
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {r.orderByDate && r.orderByDate < briefing.todayYmd ? (
                        <div>
                          <span className="text-amber-200 font-medium">Late</span>
                          <span className="block text-[11px] text-slate-500 tabular-nums">
                            Was due {formatDate(r.orderByDate)}
                          </span>
                        </div>
                      ) : (
                        formatDate(r.orderByDate)
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{daysBadge(r.daysUntilRunOut)}</td>
                    <td className="px-2 py-2 align-top">
                      <BriefingProductSignalButtons row={r} />
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
