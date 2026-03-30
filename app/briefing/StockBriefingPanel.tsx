import Link from "next/link";
import type { StockBriefing } from "@/lib/stockBriefing";
import { shopFilterLabel, type ShopFilter } from "@/lib/shopFilter";

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
      title="Estimated days of stock remaining"
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

export default function StockBriefingPanel({
  briefing,
  shop,
}: {
  briefing: StockBriefing;
  shop: ShopFilter;
}) {
  const hasPressure =
    briefing.critical0to7 > 0 ||
    briefing.urgent8to14 > 0 ||
    briefing.reorderSkuCount > 0;

  const scope = shopFilterLabel(shop);

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
            Runway and reorder actions from your latest Airtable figures.
          </p>
          <p className="text-xs text-slate-500 mt-1">{briefing.dateLabel}</p>
          <p className="text-xs text-emerald-200/80 mt-1 font-medium">Scope: {scope}</p>
        </div>
        <Link
          href="/?view=reorder&sort=orderBy"
          className="shrink-0 inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500/90 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
        >
          Open reorder queue
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-red-400/25 bg-red-500/5 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-red-200/80">0–7 days left</p>
          <p className="mt-1 text-2xl font-semibold text-red-100">{briefing.critical0to7}</p>
          <p className="text-xs text-slate-500 mt-0.5">Highest priority runway</p>
        </div>
        <div className="rounded-xl border border-amber-400/25 bg-amber-500/5 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-200/80">8–14 days</p>
          <p className="mt-1 text-2xl font-semibold text-amber-100">{briefing.urgent8to14}</p>
          <p className="text-xs text-slate-500 mt-0.5">Order soon</p>
        </div>
        <div className="rounded-xl border border-slate-600/40 bg-slate-800/40 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Reorder queue</p>
          <p className="mt-1 text-2xl font-semibold text-slate-50">
            {briefing.reorderSkuCount}{" "}
            <span className="text-base font-normal text-slate-400">SKU</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {briefing.totalUnitsToOrder.toLocaleString("en-GB")} units (computed: target cover minus
            effective stock)
          </p>
        </div>
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-200/80">
            Reorder timing (model)
          </p>
          {briefing.reorderSkuCount === 0 ? (
            <p className="mt-1 text-lg font-semibold text-slate-400">—</p>
          ) : briefing.reorderQueueHasOverdueOrderBy ? (
            <>
              <p className="mt-1 text-lg font-semibold text-amber-200">Includes overdue lines</p>
              {briefing.soonestFutureOrderByIso ? (
                <p className="text-xs text-slate-400 mt-0.5">
                  Next upcoming: {formatDate(briefing.soonestFutureOrderByIso)}
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-0.5">
                  Every line is before today (zero runway + lead, or similar)
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
          <p className="text-xs text-slate-500 mt-0.5">Run-out minus lead time</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-800/80">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {`Full reorder queue (${briefing.topReorders.length} SKU${
              briefing.topReorders.length === 1 ? "" : "s"
            })`}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Sorted by model order-by (run-out minus lead). <strong className="text-slate-400">Overdue</strong>{" "}
            means that date is before today — often many SKUs share the same date when lead time and
            runway match (e.g. no effective stock left and the same supplier lead).{" "}
            <strong className="text-slate-400">Days left</strong> is stock ÷ daily demand; it can be &gt;
            0 while the row is overdue if lead time is longer than that runway.
          </p>
        </div>
        {briefing.topReorders.length === 0 ? (
          <p className="px-3 py-6 text-sm text-slate-500 text-center">
            Nothing in the reorder queue for this scope.
          </p>
        ) : (
          <div className="max-h-[min(70vh,56rem)] overflow-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-800/80">
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium text-right">Qty</th>
                  <th
                    className="px-3 py-2 font-medium"
                    title="Calendar date from run-out minus lead. Past dates show as Overdue."
                  >
                    Model order-by
                  </th>
                  <th className="px-3 py-2 font-medium text-right">Days left</th>
                </tr>
              </thead>
              <tbody>
                {briefing.topReorders.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/50 last:border-0">
                    <td className="px-3 py-2 text-slate-100">
                      {r.name}
                      {r.brand ? (
                        <span className="block text-xs text-slate-500">{r.brand}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-200">{r.qtyToOrder}</td>
                    <td className="px-3 py-2 text-slate-300">
                      {r.orderByDate && r.orderByDate < briefing.todayYmd ? (
                        <div>
                          <span className="text-amber-200 font-medium">Overdue</span>
                          <span className="block text-[11px] text-slate-500 tabular-nums">
                            Model {formatDate(r.orderByDate)}
                          </span>
                        </div>
                      ) : (
                        formatDate(r.orderByDate)
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{daysBadge(r.daysUntilRunOut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
