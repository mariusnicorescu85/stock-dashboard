// app/product/[id]/page.tsx
import { fetchProducts, fetchMonthlySalesForProduct } from "@/lib/airtable";
import { coverBufferDaysFromEnv } from "@/lib/reorderQty";
import SalesHistoryChart, { type SalesHistoryPoint } from "@/app/components/SalesHistoryChart";
import WhatIfPanel from "./WhatIfPanel";

type ParamsPromise = Promise<{ id: string }>;

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB");
}

function recordToProductName(recordLabel: string) {
  // Handles: "2024-12 - Butter" or "2024-12 – Butter"
  // Removes leading "YYYY-MM - " part and returns just the product part
  return recordLabel
    .replace(/^\d{4}-\d{2}\s*[–-]\s*/u, "")
    .trim();
}


export default async function ProductDetailPage({
  params,
}: {
  params: ParamsPromise;
}) {
  const { id } = await params;
  const coverBufferDays = coverBufferDaysFromEnv();

  const products = await fetchProducts();
  const product = products.find((p) => p.id === id);

  if (!product) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <a
            href="/"
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            ← Back to dashboard
          </a>
          <div className="mt-6 text-lg">Product not found.</div>
        </div>
      </main>
    );
  }

  const monthlySales = await fetchMonthlySalesForProduct(product.name);

  const exactNameSales = monthlySales.filter((s) => {
  const labelName = recordToProductName(s.label).toLowerCase();
  return labelName === product.name.toLowerCase();
});


  // Sort table view newest first
  const sortedSales = [...exactNameSales].sort((a, b) => {
  const da = a.monthStart ? new Date(a.monthStart).getTime() : 0;
  const db = b.monthStart ? new Date(b.monthStart).getTime() : 0;
  return db - da;
});

const chartData: SalesHistoryPoint[] = sortedSales
  .filter((s) => s.monthStart)
  .map((s) => {
    const d = new Date(s.monthStart!);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      ym,
      label: ym,
      unitsSold: Number(s.unitsSold ?? 0),
    };
  })
  .sort((a, b) => a.ym.localeCompare(b.ym));



  const rowsWithDates = sortedSales.filter((s) => s.monthStart);

const latest = rowsWithDates[0] ?? null;


const now = new Date();
const targetYear = now.getFullYear() - 1;
const targetMonth = now.getMonth() + 1; // 1-12

const sameMonthLastYear = sortedSales.find(
  (s) => s.year === targetYear && s.month === targetMonth
) ?? null;




const sameMonthLastYearMonthly = sameMonthLastYear ? sameMonthLastYear.unitsSold : null;

const daysThisMonth =
  new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

const sameMonthLastYearDaily =
  sameMonthLastYearMonthly != null && daysThisMonth > 0
    ? sameMonthLastYearMonthly / daysThisMonth
    : null;


// last 3 months that have data (including latest)
const last3 = rowsWithDates.slice(0, 3);

const avgMonthlyDemand =
  last3.length > 0
    ? last3.reduce((sum, s) => sum + (s.monthlyDemand ?? 0), 0) / last3.length
    : null;

const avgDailyDemand =
  last3.length > 0
    ? last3.reduce((sum, s) => sum + (s.dailyDemand ?? 0), 0) / last3.length
    : null;

const pctChange =
  latest && latest.monthlyDemand != null && avgMonthlyDemand != null && avgMonthlyDemand > 0
    ? ((latest.monthlyDemand - avgMonthlyDemand) / avgMonthlyDemand) * 100
    : null;

const trendLabel =
  pctChange == null
    ? "—"
    : pctChange > 5
    ? "↑ Higher than avg"
    : pctChange < -5
    ? "↓ Lower than avg"
    : "≈ Around avg";


  return (
    <main className="min-h-screen text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
        <a href="/" className="text-sm text-slate-400 hover:text-slate-200">
          ← Back to dashboard
        </a>

        {/* Header */}
        <header className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900/70 border border-slate-800/70 text-lg font-semibold">
              {(product.brand ?? "•").slice(0, 1)}
            </div>
            <div>
              <h1 className="text-3xl font-semibold leading-tight">{product.name}</h1>
              <p className="text-sm text-slate-400">
                {product.brand} · {product.productType}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-emerald-100">
              🛠️ Runway:{" "}
              {product.daysUntilRunOut != null ? `${Math.max(0, Math.round(product.daysUntilRunOut))}d` : "—"}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-amber-100">
              📅 Order by: {formatDate(product.orderByDate)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1 text-slate-200">
              ⏱ Lead time: {product.leadTimeDays ?? "—"}d
            </span>
          </div>
        </header>

        {/* Summary cards */}
        <section className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Current stock
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {product.currentStock}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Demand this month (2024 pattern)
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {product.totalDemandThisMonth}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Days until run out
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {product.daysUntilRunOut != null
                ? Math.max(0, Math.round(product.daysUntilRunOut))
                : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Qty to order
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-300">
              {product.qtyToOrder}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Order by: {formatDate(product.orderByDate)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Qty fills the gap to target cover: (lead time + {coverBufferDays} buffer days) × daily
              demand, minus effective stock (current + incoming).
            </p>
          </div>
        </section>

        {/* Sales history chart */}
<section className="space-y-3">
  <h2 className="text-lg font-semibold">Sales history overview</h2>
  <p className="text-xs text-slate-400">
    Monthly units sold (individual only). Use Last 12 / Last 24 / All.
  </p>

  {chartData.length === 0 ? (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-sm text-slate-400">
        No monthly sales records found for this product.
      </p>
    </div>
  ) : (
    <SalesHistoryChart title="Units sold per month" data={chartData} />
  )}
</section>


        {/* Sales history table */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Sales history</h2>
          <p className="text-xs text-slate-400">
            Each row is a monthly entry from your Monthly Sales tables
            (Opatra + PYT).
          </p>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Month start</th>
                  <th className="px-3 py-2 text-right">Year</th>
                  <th className="px-3 py-2 text-right">Month</th>
                  <th className="px-3 py-2 text-right">Units sold</th>
                  <th className="px-3 py-2 text-right">Monthly demand</th>
                  <th className="px-3 py-2 text-right">Daily demand</th>
                </tr>
              </thead>
              <tbody>
                {sortedSales.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-slate-800/70 hover:bg-slate-900/90"
                  >
                    <td className="px-3 py-2">{s.label}</td>
                    <td className="px-3 py-2">
                      {formatDate(s.monthStart)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.year ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.month ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.unitsSold}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.monthlyDemand ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.dailyDemand != null
                        ? s.dailyDemand.toFixed(2)
                        : "—"}
                    </td>
                  </tr>
                ))}

                {sortedSales.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-6 text-center text-slate-400"
                    >
                      No monthly sales records found for this product.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* What-if simulation */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">What if we change demand or lead time?</h2>
          <WhatIfPanel
            currentStock={product.currentStock}
            incomingStockTotal={product.incomingStockTotal}
            dailyDemand={product.dailyDemand}
            leadTimeDays={product.leadTimeDays}
          />
        </section>

        {/* Demand trend */}
<section className="grid gap-4 sm:grid-cols-3">
  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
    <p className="text-xs uppercase tracking-wide text-slate-400">
      Latest month demand
    </p>
    <p className="mt-2 text-2xl font-semibold">
      {latest && latest.monthlyDemand != null ? latest.monthlyDemand : "—"}
    </p>
    <p className="mt-1 text-sm text-slate-400">
      Daily:{" "}
      <span className="font-medium text-slate-200">
        {latest && latest.dailyDemand != null && Number.isFinite(latest.dailyDemand)
          ? latest.dailyDemand.toFixed(2)
          : "—"}
      </span>
    </p>
    <p className="mt-1 text-xs text-slate-500">
      {latest?.label ?? "No data"}
    </p>
  </div>

  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
    <p className="text-xs uppercase tracking-wide text-slate-400">
      3-month average demand
    </p>
    <p className="mt-2 text-2xl font-semibold">
      {avgMonthlyDemand != null ? Math.round(avgMonthlyDemand) : "—"}
    </p>
    <p className="mt-1 text-sm text-slate-400">
      Daily:{" "}
      <span className="font-medium text-slate-200">
        {avgDailyDemand != null ? avgDailyDemand.toFixed(2) : "—"}
      </span>
    </p>
    <p className="mt-1 text-xs text-slate-500">
      Based on last {last3.length} month(s)
    </p>
  </div>

  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
    <p className="text-xs uppercase tracking-wide text-slate-400">
      Trend vs avg
    </p>
    <p className="mt-2 text-lg font-semibold">
      {trendLabel}
    </p>
    <p className="mt-1 text-sm text-slate-400">
      {pctChange != null ? `${pctChange.toFixed(0)}%` : "—"}
    </p>
    <p className="mt-1 text-xs text-slate-500">
      Latest vs 3-month avg
    </p>
  </div>
</section>

<div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
  <p className="text-xs uppercase tracking-wide text-slate-400">
    Same month last year
  </p>
  <p className="mt-2 text-2xl font-semibold">
    {sameMonthLastYearMonthly != null ? sameMonthLastYearMonthly : "—"}
  </p>
  <p className="mt-1 text-sm text-slate-400">
    Daily:{" "}
    <span className="font-medium text-slate-200">
      {sameMonthLastYearDaily != null ? sameMonthLastYearDaily.toFixed(2) : "—"}
    </span>
  </p>
  <p className="mt-1 text-xs text-slate-500">
    {targetYear}-{String(targetMonth).padStart(2, "0")}
  </p>
</div>


      </div>
    </main>
  );
}

type SalesChartProps = {
  monthlySales: {
    id: string;
    label: string;
    monthStart: string | null;
    year: number | null;
    month: number | null;
    unitsSold: number;
  }[];
};

// Simple server-rendered SVG bar chart (no client JS needed)
function SalesChart({ monthlySales }: SalesChartProps) {
  if (!monthlySales.length) return null;

  const maxUnits = Math.max(
    ...monthlySales.map((s) => s.unitsSold),
    0
  );

  if (maxUnits === 0) {
    return (
      <p className="text-sm text-slate-400">
        All months have zero units sold.
      </p>
    );
  }

  const barWidth = 32;
  const barGap = 14;
  const chartHeight = 80;

  const width =
    monthlySales.length * (barWidth + barGap) + barGap;
  const height = chartHeight + 24; // extra for labels

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-48 w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Axis baseline */}
      <line
        x1={0}
        y1={chartHeight}
        x2={width}
        y2={chartHeight}
        className="stroke-slate-700"
        strokeWidth={1}
      />
      {monthlySales.map((s, index) => {
        const barHeight =
          (s.unitsSold / maxUnits) * chartHeight;
        const x = barGap + index * (barWidth + barGap);
        const y = chartHeight - barHeight;

        const monthLabel =
          s.month && s.year
            ? `${s.month}/${String(s.year).slice(-2)}`
            : s.label;

        return (
          <g key={s.id} transform={`translate(${x},0)`}>
            <rect
              x={0}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={6}
              className="fill-emerald-400"
            >
              <title>{`${monthLabel}: ${s.unitsSold} units`}</title>

            </rect>
            <text
              x={barWidth / 2}
              y={chartHeight + 12}
              textAnchor="middle"
              className="fill-slate-300 text-[9px]"
            >
              {monthLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
