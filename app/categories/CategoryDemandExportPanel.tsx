"use client";

import { MONTH_SHORT } from "@/lib/categoryDemandDisplay";
import { formatDemandSliceLabel, type DemandExportSlice } from "@/lib/categoryDemandExport";

type Props = {
  shopLabel: string;
  historyYearsAsc: number[];
  selectedProductCount: number;
  totalProductCount: number;
  selectedYears: Set<number>;
  onToggleYear: (year: number) => void;
  onSelectAllYears: () => void;
  onClearYears: () => void;
  selectedMonths: Set<number>;
  onToggleMonth: (month: number) => void;
  onSelectAllMonths: () => void;
  onClearMonths: () => void;
  includeZeros: boolean;
  onIncludeZerosChange: (value: boolean) => void;
  quickSliceCount: number;
  basketSlices: DemandExportSlice[];
  onRemoveBasketSlice: (key: string) => void;
  onClearBasket: () => void;
  onDownloadQuick: () => void;
  onDownloadBasket: () => void;
};

export default function CategoryDemandExportPanel({
  shopLabel,
  historyYearsAsc,
  selectedProductCount,
  totalProductCount,
  selectedYears,
  onToggleYear,
  onSelectAllYears,
  onClearYears,
  selectedMonths,
  onToggleMonth,
  onSelectAllMonths,
  onClearMonths,
  includeZeros,
  onIncludeZerosChange,
  quickSliceCount,
  basketSlices,
  onRemoveBasketSlice,
  onClearBasket,
  onDownloadQuick,
  onDownloadBasket,
}: Props) {
  const allYearsSelected = selectedYears.size === historyYearsAsc.length;
  const allMonthsSelected = selectedMonths.size === 12;
  const quickReady = selectedProductCount > 0 && quickSliceCount > 0;
  const basketReady = basketSlices.length > 0;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">
          CSV export
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Long-format CSV: one row per product × month. Shop scope:{" "}
          <span className="text-slate-200">{shopLabel}</span>.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Quick export</h3>
            <p className="mt-1 text-xs text-slate-500">
              Tick products in <strong className="text-slate-400">Overview &amp; stock</strong>,
              choose years and months below, then download.
            </p>
          </div>

          <p className="text-xs text-slate-400">
            <span className="text-slate-200 font-medium tabular-nums">
              {selectedProductCount}
            </span>{" "}
            of{" "}
            <span className="text-slate-200 font-medium tabular-nums">
              {totalProductCount}
            </span>{" "}
            products selected ·{" "}
            <span className="text-emerald-200/90 font-medium tabular-nums">
              {quickSliceCount}
            </span>{" "}
            row{quickSliceCount === 1 ? "" : "s"} in export
          </p>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-500">
                Years
              </span>
              <button
                type="button"
                onClick={onSelectAllYears}
                disabled={allYearsSelected}
                className="text-[11px] text-emerald-300/90 hover:underline disabled:opacity-40"
              >
                All
              </button>
              <button
                type="button"
                onClick={onClearYears}
                disabled={selectedYears.size === 0}
                className="text-[11px] text-slate-400 hover:underline disabled:opacity-40"
              >
                None
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {historyYearsAsc.map((y) => {
                const on = selectedYears.has(y);
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => onToggleYear(y)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                      on
                        ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                        : "border-slate-700 bg-slate-900/70 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-500">
                Months
              </span>
              <button
                type="button"
                onClick={onSelectAllMonths}
                disabled={allMonthsSelected}
                className="text-[11px] text-emerald-300/90 hover:underline disabled:opacity-40"
              >
                All
              </button>
              <button
                type="button"
                onClick={onClearMonths}
                disabled={selectedMonths.size === 0}
                className="text-[11px] text-slate-400 hover:underline disabled:opacity-40"
              >
                None
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {MONTH_SHORT.map((label, i) => {
                const month = i + 1;
                const on = selectedMonths.has(month);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onToggleMonth(month)}
                    className={`min-w-[2.4rem] rounded-lg border px-1.5 py-1 text-[11px] font-medium transition ${
                      on
                        ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                        : "border-slate-700 bg-slate-900/70 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={includeZeros}
              onChange={(e) => onIncludeZerosChange(e.target.checked)}
              className="size-3.5 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500/40 focus:ring-offset-0"
            />
            Include zero-unit months
          </label>

          <button
            type="button"
            disabled={!quickReady}
            onClick={onDownloadQuick}
            className="h-9 inline-flex items-center justify-center rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-900/70 hover:border-emerald-400/40 transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Download CSV (quick)
          </button>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Export basket</h3>
            <p className="mt-1 text-xs text-slate-500">
              In <strong className="text-slate-400">Monthly (Jan–Dec)</strong>, click unit cells
              to add or remove individual product × month slices.
            </p>
          </div>

          <p className="text-xs text-slate-400">
            <span className="text-emerald-200/90 font-medium tabular-nums">
              {basketSlices.length}
            </span>{" "}
            slice{basketSlices.length === 1 ? "" : "s"} in basket
          </p>

          {basketSlices.length > 0 ? (
            <ul className="max-h-40 overflow-y-auto space-y-1.5 rounded-lg border border-slate-800/80 bg-slate-950/80 p-2">
              {basketSlices.map((slice) => {
                const key = `${slice.productId}:${slice.year}:${slice.month}`;
                return (
                  <li
                    key={key}
                    className="flex items-start justify-between gap-2 text-xs text-slate-300"
                  >
                    <span className="min-w-0">{formatDemandSliceLabel(slice)}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveBasketSlice(key)}
                      className="shrink-0 text-slate-500 hover:text-rose-300"
                      aria-label={`Remove ${slice.productName}`}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-slate-600 rounded-lg border border-dashed border-slate-800 px-3 py-4 text-center">
              No slices yet — click month cells in the Monthly tab.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!basketReady}
              onClick={onDownloadBasket}
              className="h-9 inline-flex items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25 transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              Download CSV (basket)
            </button>
            <button
              type="button"
              onClick={onClearBasket}
              disabled={!basketReady}
              className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-40"
            >
              Clear basket
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
