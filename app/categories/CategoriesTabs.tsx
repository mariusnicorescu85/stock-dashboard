"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import CategoryWhatIfPanel from "./CategoryWhatIfPanel";
import CategoryDemandExportPanel from "./CategoryDemandExportPanel";
import { MONTH_SHORT, fmtDemandRate } from "@/lib/categoryDemandDisplay";
import { daysInMonth } from "@/lib/StockMath";
import {
  buildQuickExportSlices,
  demandSliceKey,
  downloadCategoryDemandCsv,
  makeDemandSlice,
  type DemandExportSlice,
} from "@/lib/categoryDemandExport";

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
  /** When true, overview omits Order-by and Qty to order (e.g. combos are bundles of individually stocked SKUs). */
  hideOrderColumns?: boolean;
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
  shopLabel: string;
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

function allProductIdsFromBlocks(blocks: CategoryDemandBlock[]): Set<string> {
  const ids = new Set<string>();
  for (const block of blocks) {
    for (const item of block.items) ids.add(item.id);
  }
  return ids;
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
      <span className="text-xs text-zinc-500">Monthly view:</span>
      <div className="inline-flex rounded-lg border border-zinc-300 bg-zinc-50 p-0.5">
        <button
          type="button"
          onClick={() => onChange("units")}
          className={`${base} border-transparent ${
            mode === "units"
              ? "bg-emerald-500/20 text-emerald-800"
              : "text-zinc-500 hover:text-zinc-800"
          }`}
        >
          Units sold
        </button>
        <button
          type="button"
          onClick={() => onChange("daily")}
          className={`${base} border-transparent ${
            mode === "daily"
              ? "bg-emerald-500/20 text-emerald-800"
              : "text-zinc-500 hover:text-zinc-800"
          }`}
        >
          Implied daily
        </button>
      </div>
      <span className="text-[11px] text-zinc-500">
        “Implied daily” = that month&apos;s units ÷ calendar days (sales-based).
      </span>
    </div>
  );
}

function MonthCells(props: {
  months: number[];
  calYear: number;
  mode: "units" | "daily";
  productId: string;
  productName: string;
  brand?: string;
  categoryLabel: string;
  basketKeys: Set<string>;
  basketEnabled: boolean;
  onToggleBasket: (slice: DemandExportSlice) => void;
}) {
  const {
    months,
    calYear,
    mode,
    productId,
    productName,
    brand,
    categoryLabel,
    basketKeys,
    basketEnabled,
    onToggleBasket,
  } = props;

  return (
    <>
      {months.map((u, mi) => {
        const month = mi + 1;
        const dim = daysInMonth(calYear, mi + 1);
        const impliedDaily = u > 0 && dim > 0 ? u / dim : 0;
        const show =
          mode === "units"
            ? String(u)
            : u > 0
              ? fmtDemandRate(impliedDaily)
              : "—";
        const muted = mode === "units" ? u === 0 : u === 0;
        const key = demandSliceKey(productId, calYear, month);
        const inBasket = basketKeys.has(key);
        const clickable = basketEnabled && mode === "units";

        const title =
          mode === "units"
            ? u === 0
              ? `${MONTH_SHORT[mi]} ${calYear}: no sales`
              : `${MONTH_SHORT[mi]} ${calYear}: ${u} units (~${fmtDemandRate(impliedDaily)}/day)`
            : `${MONTH_SHORT[mi]} ${calYear}: ${u} units in ${dim} days`;

        const basketTitle = inBasket
          ? "Click to remove from export basket"
          : "Click to add to export basket";

        return (
          <td
            key={mi}
            className={`px-1.5 py-2 text-right text-xs tabular-nums ${
              muted ? "text-zinc-500" : "text-zinc-800"
            } ${
              clickable
                ? `cursor-pointer transition ${
                    inBasket
                      ? "bg-emerald-500/20 ring-1 ring-inset ring-emerald-400/50 text-emerald-800"
                      : "hover:bg-zinc-100"
                  }`
                : ""
            }`}
            title={clickable ? `${title} · ${basketTitle}` : title}
            onClick={
              clickable
                ? () =>
                    onToggleBasket(
                      makeDemandSlice(
                        productId,
                        productName,
                        brand,
                        categoryLabel,
                        calYear,
                        month,
                        u
                      )
                    )
                : undefined
            }
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleBasket(
                        makeDemandSlice(
                          productId,
                          productName,
                          brand,
                          categoryLabel,
                          calYear,
                          month,
                          u
                        )
                      );
                    }
                  }
                : undefined
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
  basketKeys: Set<string>;
  basketEnabled: boolean;
  onToggleBasket: (slice: DemandExportSlice) => void;
}) {
  const {
    label,
    calYear,
    daysInCalYear,
    block,
    mode,
    basketKeys,
    basketEnabled,
    onToggleBasket,
  } = props;
  const sorted = [...block.items].sort(compareRowsByProductName);
  const totalUnits =
    block.totalsByYear.find((t) => t.year === calYear)?.total ?? 0;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-zinc-800">{label}</h4>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="sticky left-0 z-10 bg-white/95 px-3 py-2 text-left shadow-[4px_0_12px_rgba(0,0,0,0.35)]">
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
                <span className="normal-case text-[10px] font-normal text-zinc-500">
                  from sales
                </span>
              </th>
              <th
                className="px-2 py-2 text-right whitespace-nowrap"
                title="Current sheet daily (forecast)"
              >
                Sheet
                <br />
                <span className="normal-case text-[10px] font-normal text-zinc-500">
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
                  className="border-t border-zinc-100 odd:bg-zinc-50 even:bg-white"
                >
                  <td className="sticky left-0 z-[1] border-r border-zinc-200 bg-white px-3 py-2 backdrop-blur-sm odd:bg-zinc-50/90 even:bg-zinc-100">
                    <Link
                      href={`/product/${row.id}`}
                      className="text-zinc-900 hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-500">
                    {row.brand ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-zinc-900">
                    {uTot}
                  </td>
                  <MonthCells
                    months={sl.months}
                    calYear={calYear}
                    mode={mode}
                    productId={row.id}
                    productName={row.name}
                    brand={row.brand}
                    categoryLabel={block.label}
                    basketKeys={basketKeys}
                    basketEnabled={basketEnabled}
                    onToggleBasket={onToggleBasket}
                  />
                  <td className="px-2 py-2 text-right text-xs tabular-nums text-emerald-700/90">
                    {fmtDemandRate(avgDay)}
                  </td>
                  <td className="px-2 py-2 text-right text-xs tabular-nums text-zinc-600">
                    {fmtDemandRate(row.sheetDaily)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-300 bg-zinc-100 text-xs text-zinc-800">
              <td
                colSpan={2}
                className="sticky left-0 z-[1] bg-zinc-50/95 px-3 py-2 text-left font-medium shadow-[4px_0_12px_rgba(0,0,0,0.35)]"
              >
                Category total
              </td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums text-emerald-700">
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
                        ? "text-zinc-500"
                        : "text-zinc-800"
                    }`}
                  >
                    {show}
                  </td>
                );
              })}
              <td className="px-2 py-2 text-right font-medium tabular-nums text-emerald-700/90">
                {fmtDemandRate(
                  totalUnits > 0 ? totalUnits / daysInCalYear : 0
                )}
              </td>
              <td className="px-2 py-2 text-right font-medium tabular-nums text-zinc-600">
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
  const { shopLabel, primaryYear, historyYearsAsc, daysInYearByYear, blocks } = props;
  const [tab, setTab] = useState<TabId>("overview");
  const [monthlyMode, setMonthlyMode] = useState<"units" | "daily">("units");

  const totalProductCount = useMemo(
    () => blocks.reduce((n, b) => n + b.items.length, 0),
    [blocks]
  );

  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() =>
    allProductIdsFromBlocks(blocks)
  );
  const [selectedYears, setSelectedYears] = useState<Set<number>>(
    () => new Set(historyYearsAsc)
  );
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(
    () => new Set(Array.from({ length: 12 }, (_, i) => i + 1))
  );
  const [includeZeros, setIncludeZeros] = useState(false);
  const [basket, setBasket] = useState<Map<string, DemandExportSlice>>(() => new Map());

  const blockSelectAllRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  useEffect(() => {
    setSelectedProductIds(allProductIdsFromBlocks(blocks));
    setSelectedYears(new Set(historyYearsAsc));
    setBasket(new Map());
  }, [blocks, historyYearsAsc]);

  const basketKeys = useMemo(() => new Set(basket.keys()), [basket]);

  const basketSlices = useMemo(() => {
    const slices = [...basket.values()];
    slices.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.month !== b.month) return a.month - b.month;
      const cat = a.categoryLabel.localeCompare(b.categoryLabel, undefined, {
        sensitivity: "base",
      });
      if (cat !== 0) return cat;
      return a.productName.localeCompare(b.productName, undefined, {
        sensitivity: "base",
      });
    });
    return slices;
  }, [basket]);

  const quickSlices = useMemo(
    () =>
      buildQuickExportSlices(
        blocks,
        selectedProductIds,
        selectedYears,
        selectedMonths,
        includeZeros
      ),
    [blocks, selectedProductIds, selectedYears, selectedMonths, includeZeros]
  );

  const toggleProduct = useCallback((id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleBlockProducts = useCallback((block: CategoryDemandBlock) => {
    setSelectedProductIds((prev) => {
      const blockIds = block.items.map((r) => r.id);
      const allOn = blockIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allOn) {
        for (const id of blockIds) next.delete(id);
      } else {
        for (const id of blockIds) next.add(id);
      }
      return next;
    });
  }, []);

  const toggleYear = useCallback((year: number) => {
    setSelectedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }, []);

  const toggleMonth = useCallback((month: number) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }, []);

  const toggleBasketSlice = useCallback((slice: DemandExportSlice) => {
    const key = demandSliceKey(slice.productId, slice.year, slice.month);
    setBasket((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, slice);
      return next;
    });
  }, []);

  const removeBasketSlice = useCallback((key: string) => {
    setBasket((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const clearBasket = useCallback(() => setBasket(new Map()), []);

  const downloadQuick = useCallback(() => {
    downloadCategoryDemandCsv(shopLabel, quickSlices, "quick");
  }, [shopLabel, quickSlices]);

  const downloadBasket = useCallback(() => {
    downloadCategoryDemandCsv(shopLabel, basketSlices, "basket");
  }, [shopLabel, basketSlices]);

  useEffect(() => {
    for (const block of blocks) {
      const el = blockSelectAllRefs.current.get(block.id);
      if (!el) continue;
      const blockIds = block.items.map((r) => r.id);
      const selectedCount = blockIds.filter((id) => selectedProductIds.has(id)).length;
      el.indeterminate = selectedCount > 0 && selectedCount < blockIds.length;
    }
  }, [blocks, selectedProductIds]);

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
            ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-800"
            : "border-zinc-300 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
        }`}
      >
        {label}
      </button>
    );
  };

  const daysPrimary = daysInYearFromList(daysInYearByYear, primaryYear);

  return (
    <div className="space-y-4">
      <CategoryDemandExportPanel
        shopLabel={shopLabel}
        historyYearsAsc={historyYearsAsc}
        selectedProductCount={selectedProductIds.size}
        totalProductCount={totalProductCount}
        selectedYears={selectedYears}
        onToggleYear={toggleYear}
        onSelectAllYears={() => setSelectedYears(new Set(historyYearsAsc))}
        onClearYears={() => setSelectedYears(new Set())}
        selectedMonths={selectedMonths}
        onToggleMonth={toggleMonth}
        onSelectAllMonths={() =>
          setSelectedMonths(new Set(Array.from({ length: 12 }, (_, i) => i + 1)))
        }
        onClearMonths={() => setSelectedMonths(new Set())}
        includeZeros={includeZeros}
        onIncludeZerosChange={setIncludeZeros}
        quickSliceCount={quickSlices.length}
        basketSlices={basketSlices}
        onRemoveBasketSlice={removeBasketSlice}
        onClearBasket={clearBasket}
        onDownloadQuick={downloadQuick}
        onDownloadBasket={downloadBasket}
      />

      <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">
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
          {blocks.map((block) => {
            const blockIds = block.items.map((r) => r.id);
            const blockAllSelected =
              blockIds.length > 0 && blockIds.every((id) => selectedProductIds.has(id));

            return (
            <div
              key={block.id}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.4)] space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                    Category
                  </p>
                  <h2 className="text-lg font-semibold">{block.label}</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {block.description}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                    Units sold {primaryYear}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-indigo-600">
                    {primaryTotalForBlock(block)}
                  </p>
                  <p className="text-xs text-zinc-500 max-w-xs text-right">
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

              <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                <table className="min-w-[720px] w-full text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-2 py-2 text-left w-10">
                        <input
                          ref={(el) => {
                            if (el) blockSelectAllRefs.current.set(block.id, el);
                            else blockSelectAllRefs.current.delete(block.id);
                          }}
                          type="checkbox"
                          checked={blockAllSelected}
                          onChange={() => toggleBlockProducts(block)}
                          aria-label={`Select all in ${block.label}`}
                          className="size-4 rounded border-zinc-300 bg-zinc-50 text-emerald-8000 focus:ring-emerald-500/40 focus:ring-offset-0"
                        />
                      </th>
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
                        <span className="normal-case text-[10px] font-normal text-zinc-500">
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
                      {!block.hideOrderColumns && (
                        <>
                          <th className="px-3 py-2 text-right">Order-by</th>
                          <th className="px-3 py-2 text-right">Qty to order</th>
                        </>
                      )}
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
                        const isSelected = selectedProductIds.has(row.id);
                        return (
                          <tr
                            key={row.id}
                            className={`border-t border-zinc-100 odd:bg-zinc-50 even:bg-white ${
                              isSelected ? "" : "opacity-55"
                            }`}
                          >
                            <td className="px-2 py-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleProduct(row.id)}
                                aria-label={`Include ${row.name} in quick export`}
                                className="size-4 rounded border-zinc-300 bg-zinc-50 text-emerald-8000 focus:ring-emerald-500/40 focus:ring-offset-0"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Link
                                href={`/product/${row.id}`}
                                className="text-zinc-900 hover:underline"
                              >
                                {row.name}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-zinc-500">
                              {row.brand ?? "—"}
                            </td>
                            {historyYearsAsc.map((y) => {
                              const sl = sliceForYear(row, y);
                              return (
                                <td
                                  key={y}
                                  className={`px-3 py-2 text-right tabular-nums ${
                                    y === primaryYear
                                      ? "text-zinc-900"
                                      : "text-zinc-500"
                                  }`}
                                >
                                  {sl.totalUnits}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-right text-xs tabular-nums text-emerald-700/90">
                              {fmtDemandRate(yearlyDaily)}
                            </td>
                            <td className="px-3 py-2 text-right text-xs tabular-nums text-zinc-600">
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
                            {!block.hideOrderColumns && (
                              <>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {row.orderBy ?? "—"}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-700">
                                  {row.qtyToOrder}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {tab === "monthly" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm text-zinc-600">
              One table per calendar year in range{" "}
              <strong className="text-zinc-900">
                {historyYearsAsc[0]}–{primaryYear}
              </strong>{" "}
              (newest first below). Month-by-month{" "}
              <strong className="text-zinc-900">units sold</strong> from your
              Monthly Sales tables, plus{" "}
              <strong className="text-zinc-900">implied daily</strong> (that
              month&apos;s units ÷ days in the month).{" "}
              <strong className="text-zinc-900">Sheet daily</strong> is the
              current forecast from each product row.
            </p>
            <p className="mt-2 text-xs text-indigo-600">
              Export basket: switch to <strong className="text-emerald-800">Units sold</strong>{" "}
              and click individual month cells to add or remove slices from your basket.
            </p>
            <div className="mt-4">
              <MonthlyModeToggle mode={monthlyMode} onChange={setMonthlyMode} />
            </div>
          </div>

          {blocks.map((block) => (
            <div
              key={block.id}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.4)] space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">
                  {block.label}
                </h3>
                <p className="text-sm text-zinc-500">{block.description}</p>
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
                  basketKeys={basketKeys}
                  basketEnabled={monthlyMode === "units"}
                  onToggleBasket={toggleBasketSlice}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
