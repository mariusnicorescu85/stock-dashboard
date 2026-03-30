"use client";

import { useState } from "react";
import Link from "next/link";
import CategoryWhatIfPanel from "./CategoryWhatIfPanel";
import { MONTH_SHORT, fmtDemandRate } from "@/lib/categoryDemandDisplay";
import { daysInMonth } from "@/lib/StockMath";

export type YearSalesSlice = {
  year: number;
  totalUnits: number;
  months: number[];
};

export type CategoryDemandRow = {
  id: string;
  name: string;
  brand?: string;
  /** Oldest → newest calendar year */
  byYear: YearSalesSlice[];
  sheetDaily: number;
  currentStock: number;
  incomingStockTotal: number;
  runOut: string | null;
  orderBy: string | null;
  qtyToOrder: number;
};

export type CategoryDemandBlock = {
  id: string;
  label: string;
  description: string;
  primaryYear: number;
  totalsByYear: { year: number; total: number }[];
  totalCurrentStock: number;
  totalIncomingStock: number;
  totalDailyDemand: number;
  avgLeadTime: number;
  items: CategoryDemandRow[];
  /** When true, overview table omits current stock, incoming, and run-out (e.g. combo demand-only). */
  hideStockRunoutColumns?: boolean;
};

function sliceForYear(row: CategoryDemandRow, calYear: number): YearSalesSlice {
  return (
    row.byYear.find((s) => s.year === calYear) ?? {
      year: calYear,
      totalUnits: 0,
      months: Array(12).fill(0),
    }
  );
}

/** Stable row order across year selection (sorting by volume made rows jump when primary year changed). */
function compareRowsByProductName(a: CategoryDemandRow, b: CategoryDemandRow): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

type TabId = "overview" | "monthly";

type Props = {
  primaryYear: number;
  historyYearsAsc: number[];
  daysInYearByYear: { year: number; days: number }[];
  blocks: CategoryDemandBlock[];
};

function daysInYearFromList(
  list: { year: number; days: number }[],
  y: number
): number {
  return list.find((d) => d.year === y)?.days ?? 365;
}

function MonthlyModeToggle(props: {
  mode: "units" | "daily";
  onChange: (m: "units" | "daily") => void;
}) {
  const { mode, onChange } = props;
  const base =
    "rounded-lg border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500">Monthly view:</span>
      <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950/80 p-0.5">
        <button
          type="button"
          onClick={() => onChange("units")}
          className={`${base} border-transparent ${
            mode === "units"
              ? "bg-emerald-500/20 text-emerald-100"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Units sold
        </button>
        <button
          type="button"
          onClick={() => onChange("daily")}
          className={`${base} border-transparent ${
            mode === "daily"
              ? "bg-emerald-500/20 text-emerald-100"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Implied daily
        </button>
      </div>
      <span className="text-[11px] text-slate-500">
        “Implied daily” = that month&apos;s units ÷ calendar days (sales-based).
      </span>
    </div>
  );
}

function MonthCells(props: {
  months: number[];
  calYear: number;
  mode: "units" | "daily";
}) {
  const { months, calYear, mode } = props;
  return (
    <>
      {months.map((u, mi) => {
        const dim = daysInMonth(calYear, mi + 1);
        const impliedDaily = u > 0 && dim > 0 ? u / dim : 0;
        const show =
          mode === "units"
            ? String(u)
            : u > 0
              ? fmtDemandRate(impliedDaily)
              : "—";
        const muted = mode === "units" ? u === 0 : u === 0;
        return (
          <td
            key={mi}
            className={`px-1.5 py-2 text-right text-xs tabular-nums ${
              muted ? "text-slate-600" : "text-slate-200"
            }`}
            title={
              mode === "units"
                ? u === 0
                  ? `${MONTH_SHORT[mi]} ${calYear}: no sales`
                  : `${MONTH_SHORT[mi]} ${calYear}: ${u} units (~${fmtDemandRate(impliedDaily)}/day)`
                : `${MONTH_SHORT[mi]} ${calYear}: ${u} units in ${dim} days`
            }
          >
            {show}
          </td>
        );
      })}
    </>
  );
}

function MonthlyTable(props: {
  label: string;
  calYear: number;
  daysInCalYear: number;
  block: CategoryDemandBlock;
  mode: "units" | "daily";
}) {
  const { label, calYear, daysInCalYear, block, mode } = props;
  const sorted = [...block.items].sort(compareRowsByProductName);
  const totalUnits =
    block.totalsByYear.find((t) => t.year === calYear)?.total ?? 0;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-slate-200">{label}</h4>
      <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/70">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-slate-950/80 text-xs uppercase text-slate-400">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-950/95 px-3 py-2 text-left shadow-[4px_0_12px_rgba(0,0,0,0.35)]">
                Product
              </th>
              <th className="px-3 py-2 text-left">Brand</th>
              <th className="px-2 py-2 text-right whitespace-nowrap">
                Total {calYear}
              </th>
              {MONTH_SHORT.map((m) => (
                <th
                  key={m}
                  className="px-1.5 py-2 text-right text-[10px] tracking-tight whitespace-nowrap"
                  title={`${m} ${calYear}`}
                >
                  {m}
                </th>
              ))}
              <th
                className="px-2 py-2 text-right whitespace-nowrap"
                title={`Total ÷ ${daysInCalYear} days`}
              >
                Avg /day
                <br />
                <span className="normal-case text-[10px] font-normal text-slate-500">
                  from sales
                </span>
              </th>
              <th
                className="px-2 py-2 text-right whitespace-nowrap"
                title="Current sheet daily (forecast)"
              >
                Sheet
                <br />
                <span className="normal-case text-[10px] font-normal text-slate-500">
                  daily
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const sl = sliceForYear(row, calYear);
              const uTot = sl.totalUnits;
              const avgDay = uTot > 0 ? uTot / daysInCalYear : 0;
              return (
                <tr
                  key={row.id}
                  className="border-t border-slate-900/70 odd:bg-slate-900/40 even:bg-slate-900/20"
                >
                  <td className="sticky left-0 z-[1] border-r border-slate-800/80 bg-slate-950/90 px-3 py-2 backdrop-blur-sm odd:bg-slate-900/90 even:bg-slate-900/80">
                    <Link
                      href={`/product/${row.id}`}
                      className="text-slate-100 hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {row.brand ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-100">
                    {uTot}
                  </td>
                  <MonthCells
                    months={sl.months}
                    calYear={calYear}
                    mode={mode}
                  />
                  <td className="px-2 py-2 text-right text-xs tabular-nums text-emerald-200/90">
                    {fmtDemandRate(avgDay)}
                  </td>
                  <td className="px-2 py-2 text-right text-xs tabular-nums text-slate-300">
                    {fmtDemandRate(row.sheetDaily)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-700 bg-slate-900/80 text-xs text-slate-200">
              <td
                colSpan={2}
                className="sticky left-0 z-[1] bg-slate-900/95 px-3 py-2 text-left font-medium shadow-[4px_0_12px_rgba(0,0,0,0.35)]"
              >
                Category total
              </td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums text-emerald-200">
                {totalUnits}
              </td>
              {MONTH_SHORT.map((m, mi) => {
                const colSum = block.items.reduce(
                  (s, r) => s + (sliceForYear(r, calYear).months[mi] ?? 0),
                  0
                );
                const dim = daysInMonth(calYear, mi + 1);
                const impliedDaily =
                  colSum > 0 && dim > 0 ? colSum / dim : 0;
                const show =
                  mode === "units"
                    ? String(colSum)
                    : colSum > 0
                      ? fmtDemandRate(impliedDaily)
                      : "—";
                return (
                  <td
                    key={m}
                    className={`px-1.5 py-2 text-right font-medium tabular-nums ${
                      mode === "units" && colSum === 0
                        ? "text-slate-500"
                        : "text-slate-200"
                    }`}
                  >
                    {show}
                  </td>
                );
              })}
              <td className="px-2 py-2 text-right font-medium tabular-nums text-emerald-200/90">
                {fmtDemandRate(
                  totalUnits > 0 ? totalUnits / daysInCalYear : 0
                )}
              </td>
              <td className="px-2 py-2 text-right font-medium tabular-nums text-slate-300">
                {fmtDemandRate(
                  block.items.reduce((s, r) => s + r.sheetDaily, 0)
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function CategoriesTabs(props: Props) {
  const { primaryYear, historyYearsAsc, daysInYearByYear, blocks } = props;
  const [tab, setTab] = useState<TabId>("overview");
  const [monthlyMode, setMonthlyMode] = useState<"units" | "daily">("units");

  const yearsNewestFirst = [...historyYearsAsc].reverse();

  const primaryTotalForBlock = (b: CategoryDemandBlock) =>
    b.totalsByYear.find((t) => t.year === primaryYear)?.total ?? 0;

  const tabBtn = (id: TabId, label: string) => {
    const active = tab === id;
    return (
      <button
        type="button"
        onClick={() => setTab(id)}
        className={`rounded-lg border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
          active
            ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
            : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:text-slate-100"
        }`}
      >
        {label}
      </button>
    );
  };

  const daysPrimary = daysInYearFromList(daysInYearByYear, primaryYear);

  return (
    <div className="space-y-4">
      <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
        Layout
      </p>
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Category data view"
      >
        {tabBtn("overview", "Overview & stock")}
        {tabBtn("monthly", "Monthly (Jan–Dec)")}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          {blocks.map((block) => (
            <div
              key={block.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.4)] space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                    Category
                  </p>
                  <h2 className="text-lg font-semibold">{block.label}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {block.description}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    Units sold {primaryYear}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-300">
                    {primaryTotalForBlock(block)}
                  </p>
                  <p className="text-xs text-slate-500 max-w-xs text-right">
                    {block.totalsByYear
                      .filter((t) => t.year !== primaryYear)
                      .map((t) => `${t.year}: ${t.total}`)
                      .join(" · ")}
                    {block.totalsByYear.some((t) => t.year !== primaryYear)
                      ? " · "
                      : ""}
                    {block.items.length} item
                    {block.items.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              {!block.hideStockRunoutColumns && (
                <CategoryWhatIfPanel
                  label={block.label}
                  initialCurrentStock={block.totalCurrentStock}
                  initialIncomingStock={block.totalIncomingStock}
                  initialDailyDemand={block.totalDailyDemand}
                  initialLeadTimeDays={block.avgLeadTime}
                />
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/70">
                <table className="min-w-[720px] w-full text-sm">
                  <thead className="bg-slate-950/80 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-left">Brand</th>
                      {historyYearsAsc.map((y) => (
                        <th key={y} className="px-3 py-2 text-right whitespace-nowrap">
                          Units {y}
                        </th>
                      ))}
                      <th
                        className="px-3 py-2 text-right whitespace-nowrap"
                        title={`${primaryYear} total ÷ ${daysPrimary} days`}
                      >
                        Avg /day
                        <br />
                        <span className="normal-case text-[10px] font-normal text-slate-500">
                          {primaryYear} sales
                        </span>
                      </th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">
                        Sheet daily
                      </th>
                      {!block.hideStockRunoutColumns && (
                        <>
                          <th className="px-3 py-2 text-right">Current stock</th>
                          <th className="px-3 py-2 text-right">Incoming</th>
                          <th className="px-3 py-2 text-right">Run-out</th>
                        </>
                      )}
                      <th className="px-3 py-2 text-right">Order-by</th>
                      <th className="px-3 py-2 text-right">Qty to order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...block.items]
                      .sort(compareRowsByProductName)
                      .map((row) => {
                        const primarySlice = sliceForYear(row, primaryYear);
                        const yearlyDaily =
                          primarySlice.totalUnits > 0
                            ? primarySlice.totalUnits / daysPrimary
                            : 0;
                        return (
                          <tr
                            key={row.id}
                            className="border-t border-slate-900/70 odd:bg-slate-900/40 even:bg-slate-900/20"
                          >
                            <td className="px-3 py-2">
                              <Link
                                href={`/product/${row.id}`}
                                className="text-slate-100 hover:underline"
                              >
                                {row.name}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-slate-400">
                              {row.brand ?? "—"}
                            </td>
                            {historyYearsAsc.map((y) => {
                              const sl = sliceForYear(row, y);
                              return (
                                <td
                                  key={y}
                                  className={`px-3 py-2 text-right tabular-nums ${
                                    y === primaryYear
                                      ? "text-slate-100"
                                      : "text-slate-400"
                                  }`}
                                >
                                  {sl.totalUnits}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-right text-xs tabular-nums text-emerald-200/90">
                              {fmtDemandRate(yearlyDaily)}
                            </td>
                            <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-300">
                              {fmtDemandRate(row.sheetDaily)}
                            </td>
                            {!block.hideStockRunoutColumns && (
                              <>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {row.currentStock}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {row.incomingStockTotal}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {row.runOut ?? "—"}
                                </td>
                              </>
                            )}
                            <td className="px-3 py-2 text-right tabular-nums">
                              {row.orderBy ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-200">
                              {row.qtyToOrder}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "monthly" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-sm text-slate-300">
              One table per calendar year in range{" "}
              <strong className="text-slate-100">
                {historyYearsAsc[0]}–{primaryYear}
              </strong>{" "}
              (newest first below). Month-by-month{" "}
              <strong className="text-slate-100">units sold</strong> from your
              Monthly Sales tables, plus{" "}
              <strong className="text-slate-100">implied daily</strong> (that
              month&apos;s units ÷ days in the month).{" "}
              <strong className="text-slate-100">Sheet daily</strong> is the
              current forecast from each product row.
            </p>
            <div className="mt-4">
              <MonthlyModeToggle mode={monthlyMode} onChange={setMonthlyMode} />
            </div>
          </div>

          {blocks.map((block) => (
            <div
              key={block.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.4)] space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold text-slate-100">
                  {block.label}
                </h3>
                <p className="text-sm text-slate-400">{block.description}</p>
              </div>

              {yearsNewestFirst.map((calYear) => (
                <MonthlyTable
                  key={calYear}
                  label={`${calYear} — monthly`}
                  calYear={calYear}
                  daysInCalYear={daysInYearFromList(
                    daysInYearByYear,
                    calYear
                  )}
                  block={block}
                  mode={monthlyMode}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
