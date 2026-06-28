"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addCalendarDaysYmd } from "@/lib/addCalendarDaysYmd";
import { reorderRowIsBriefingSnoozed } from "@/lib/briefingProductSignals";
import type { ProductRecord } from "@/lib/airtable";
import { daysCoverageWithMinOrderChunk, minimumOrderableChunkUnits } from "@/lib/minOrderCoverage";
import { formatMoneyOptional } from "@/lib/money";
import { monitorPressureLabel } from "@/lib/monitorPressureTier";
import type { BriefingTopReorder, StockBriefing } from "@/lib/stockBriefing";
import BriefingProductSignalButtons from "@/app/briefing/BriefingProductSignalButtons";
import {
  monitorQueueDaysMutedClass,
  monitorQueueDaysText,
  monitorQueueFormatDate,
  monitorQueueTierTextClass,
} from "@/app/monitor/monitorQueueDisplay";

type ViewMode = "lines" | "category";

function categoryLabel(productsById: Map<string, ProductRecord>, rowId: string): string {
  const raw = productsById.get(rowId)?.category;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : "Uncategorised";
}

function MonitorQueueRow({
  briefing,
  pRec,
  r,
}: {
  briefing: StockBriefing;
  pRec?: ProductRecord;
  r: BriefingTopReorder;
}) {
  const tier = monitorPressureLabel(r.daysUntilRunOut ?? null);
  let minCover: number | null = null;
  let chunkUnits = 1;
  if (pRec) {
    chunkUnits = minimumOrderableChunkUnits(pRec.orderMoq, pRec.orderPackSize);
    minCover = daysCoverageWithMinOrderChunk(
      pRec.effectiveStock,
      pRec.dailyDemand,
      pRec.orderMoq,
      pRec.orderPackSize
    );
  }
  const runOutGuess =
    r.daysUntilRunOut != null && Number.isFinite(r.daysUntilRunOut) && r.daysUntilRunOut >= 0
      ? addCalendarDaysYmd(briefing.todayYmd, Math.round(r.daysUntilRunOut))
      : null;
  const minCoverDaysRounded =
    minCover != null && Number.isFinite(minCover) ? Math.round(minCover) : null;
  const minCoverUntilGuess =
    minCoverDaysRounded != null ? addCalendarDaysYmd(briefing.todayYmd, minCoverDaysRounded) : null;
  const sigSnoozed = reorderRowIsBriefingSnoozed(r, briefing.todayYmd);
  const ordered = r.briefingOrderedAt != null && r.briefingOrderedAt !== "";
  const isMinOnlySuggested = chunkUnits >= r.qtyToOrder || r.qtyToOrder <= 0;

  const leadDaysRounded =
    pRec?.leadTimeDays != null && Number.isFinite(Number(pRec.leadTimeDays))
      ? Math.max(0, Math.round(Number(pRec.leadTimeDays)))
      : null;
  const estArrivalIfOrderedToday =
    leadDaysRounded != null ? addCalendarDaysYmd(briefing.todayYmd, leadDaysRounded) : null;

  return (
    <tr className="align-top hover:bg-white/[0.02] transition-colors">
      <td className="py-4 pl-4 align-top lg:pl-0">
        <span
          className={`block text-[12px] font-medium leading-snug ${monitorQueueTierTextClass(tier.tone)}`}
          title={tier.label}
        >
          {tier.label}
        </span>
      </td>
      <td className="py-4 pr-4 align-top">
        <span className="font-medium leading-snug text-zinc-900">{r.name}</span>
        {r.brand ? (
          <span className="mt-0.5 block text-[12px] text-zinc-500">{String(r.brand)}</span>
        ) : null}
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
          {sigSnoozed ? <span className="text-violet-400/90">Snoozed</span> : null}
          {ordered ? <span className="text-zinc-500">Order placed</span> : null}
        </div>
      </td>
      <td
        className="hidden py-4 pr-4 tabular-nums sm:table-cell"
        title="Approximation from runway days"
      >
        {runOutGuess ? monitorQueueFormatDate(runOutGuess) : "—"}
      </td>
      <td className="whitespace-nowrap py-4 pr-4 align-top">
        {r.orderByDate && r.orderByDate < briefing.todayYmd ? (
          <span className="text-[12px]">
            <span className="font-semibold text-amber-400">Late</span>
            <span className="mt-0.5 block tabular-nums text-zinc-500">
              {monitorQueueFormatDate(r.orderByDate)}
            </span>
          </span>
        ) : (
          <span className="tabular-nums text-zinc-500">{monitorQueueFormatDate(r.orderByDate)}</span>
        )}
      </td>
      <td
        className="whitespace-nowrap py-4 pr-4 align-top tabular-nums text-zinc-500"
        title="If you order today: calendar today plus supplier lead days from Airtable (illustrative, not a promised delivery date)."
      >
        {estArrivalIfOrderedToday ? monitorQueueFormatDate(estArrivalIfOrderedToday) : "—"}
      </td>
      <td className={`py-4 pr-4 text-right align-top ${monitorQueueDaysMutedClass(r.daysUntilRunOut)}`}>
        {monitorQueueDaysText(r.daysUntilRunOut)}
      </td>
      <td className="py-4 pr-4 text-right align-top tabular-nums font-semibold text-indigo-600">
        {r.qtyToOrder}
      </td>
      <td className="hidden py-4 pr-4 text-right align-top tabular-nums text-zinc-500 lg:table-cell">
        {chunkUnits}
      </td>
      <td
        className="hidden py-4 pr-4 text-right align-top tabular-nums md:table-cell"
        title="Smallest allowed buy: runway in days, then approx. calendar date covered until (modelled like run-out date)"
      >
        {minCover != null ? (
          <span className="flex flex-col items-end gap-0.5 leading-tight">
            <span>
              {Math.round(minCover)}d
              {!isMinOnlySuggested ? (
                <span className="ml-1 text-[11px] font-normal text-amber-400/95">thin</span>
              ) : null}
            </span>
            {minCoverUntilGuess ? (
              <span className="text-[11px] font-normal tabular-nums text-zinc-500">
                {monitorQueueFormatDate(minCoverUntilGuess)}
              </span>
            ) : null}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="hidden py-4 pr-4 text-right align-top tabular-nums md:table-cell">
        {formatMoneyOptional(
          r.pricePerUnit != null ? r.qtyToOrder * r.pricePerUnit : null,
          r.purchaseCurrency
        )}
      </td>
      <td className="py-3 align-top">
        <BriefingProductSignalButtons row={r} />
      </td>
      <td className="py-4 pr-4 text-right align-top lg:pr-0">
        <Link
          href={`/product/${encodeURIComponent(r.id)}`}
          className="text-[12px] font-medium text-zinc-500 hover:text-indigo-600 transition-colors"
        >
          Detail
        </Link>
      </td>
    </tr>
  );
}

export default function MonitorReplenishmentQueue({
  briefing,
  products,
  rows,
}: {
  briefing: StockBriefing;
  products: ProductRecord[];
  rows: BriefingTopReorder[];
}) {
  const [view, setView] = useState<ViewMode>("lines");

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const categoryBlocks = useMemo(() => {
    const m = new Map<string, BriefingTopReorder[]>();
    for (const r of rows) {
      const label = categoryLabel(productsById, r.id);
      if (!m.has(label)) m.set(label, []);
      m.get(label)!.push(r);
    }

    const blocks = [...m.entries()].map(([label, group]) => {
      let soonestDays: number | null = null;
      for (const rr of group) {
        if (rr.daysUntilRunOut == null || !Number.isFinite(rr.daysUntilRunOut)) continue;
        const d = Math.max(0, Math.round(rr.daysUntilRunOut));
        if (soonestDays === null || d < soonestDays) soonestDays = d;
      }
      const units = group.reduce((sum, rr) => sum + rr.qtyToOrder, 0);
      const runOutBand =
        soonestDays != null ? addCalendarDaysYmd(briefing.todayYmd, soonestDays) : null;
      return { group, label, runOutBand, soonestDays, units };
    });

    blocks.sort((a, b) => {
      const aw = a.soonestDays == null ? Infinity : a.soonestDays;
      const bw = b.soonestDays == null ? Infinity : b.soonestDays;
      if (aw !== bw) return aw - bw;
      return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    });
    return blocks;
  }, [briefing.todayYmd, productsById, rows]);

  return (
    <div className="-mx-4 overflow-hidden sm:-mx-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 lg:px-0">
        <p className="text-sm text-zinc-500">
          Queue view<span className="sr-only"> (lines or grouped by category)</span>
        </p>
        <div
          className="inline-flex rounded-lg border border-zinc-300/75 bg-zinc-50 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          role="group"
          aria-label="Queue grouping"
        >
          <button
            type="button"
            aria-pressed={view === "lines"}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === "lines"
                ? "bg-zinc-200 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
            onClick={() => setView("lines")}
          >
            Lines
          </button>
          <button
            type="button"
            aria-pressed={view === "category"}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === "category"
                ? "bg-zinc-200 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
            onClick={() => setView("category")}
          >
            Category
          </button>
        </div>
      </div>

      <div className="max-h-[min(74vh,60rem)] overflow-auto">
        <table className="w-full min-w-[72rem] border-collapse text-[13px]">
          <thead>
            <tr className="sticky top-0 z-10 bg-white text-left text-[11px] font-medium capitalize tracking-normal text-zinc-500 shadow-[inset_0_-1px_0_0] shadow-zinc-200 [&_th]:pb-3 [&_th]:pt-1">
              <th className="w-[13%] pl-4 pr-2 sm:w-[12.5rem] lg:pl-0">Attention</th>
              <th className="min-w-[12rem] pr-4">Product</th>
              <th className="w-[9%] pr-4 hidden sm:table-cell">Run out*</th>
              <th className="w-[9%] pr-4">Order by</th>
              <th className="normal-case w-[10%] min-w-[7rem] max-w-[8.25rem] pr-4 lg:w-[9%]">
                <abbr
                  className="cursor-help no-underline"
                  title="If you place the order today: approximate arrival date using Airtable lead time as calendar days (illustrative)."
                >
                  Est. arrival*
                </abbr>
              </th>
              <th className="w-[5.5rem] pr-4 text-right">Days</th>
              <th className="w-[5rem] pr-4 text-right">Qty</th>
              <th className="hidden w-[5rem] pr-4 text-right lg:table-cell">
                <abbr
                  className="cursor-help no-underline"
                  title="Minimum you can buy in one step — supplier minimum order and pack size"
                >
                  Min buy*
                </abbr>
              </th>
              <th className="hidden min-w-[6.75rem] w-[7.5rem] pr-4 text-right md:table-cell">
                Min only*
              </th>
              <th className="hidden w-[6.75rem] pr-4 text-right md:table-cell">Line</th>
              <th className="w-[6.75rem] pl-2 pr-1">Signals</th>
              <th className="w-14 pr-4 lg:pr-0" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 text-zinc-800">
            {view === "lines"
              ? rows.map((r) => (
                  <MonitorQueueRow key={r.id} briefing={briefing} pRec={productsById.get(r.id)} r={r} />
                ))
              : categoryBlocks.flatMap(({ group, label, runOutBand, soonestDays, units }) => {
                  const ribbon = (
                    <tr key={`cat-${label}`} className="bg-zinc-50/95">
                      <th
                        scope="colgroup"
                        colSpan={12}
                        className="border-t border-zinc-300 px-4 py-2.5 text-left font-semibold lg:px-5"
                      >
                        <span className="block text-[13px] leading-snug text-zinc-900">{label}</span>
                        <span className="mt-0.5 block text-[12px] font-normal normal-case tracking-normal text-zinc-500">
                          {group.length} line{group.length === 1 ? "" : "s"}
                          {" · "}
                          <span className="tabular-nums text-zinc-600">{units.toLocaleString("en-GB")}</span> units
                          {soonestDays != null ? (
                            <>
                              {" · "}Soonest runway{" "}
                              <span className="tabular-nums font-medium text-zinc-800">{soonestDays}d</span>
                            </>
                          ) : (
                            ""
                          )}
                          {runOutBand ? (
                            <>
                              {" · "}Run out ~
                              <span className="ml-1 tabular-nums text-zinc-600">
                                {monitorQueueFormatDate(runOutBand)}
                              </span>
                            </>
                          ) : soonestDays == null ? (
                            <> · Run out approx. —</>
                          ) : null}
                        </span>
                      </th>
                    </tr>
                  );

                  const bodyRows = group.map((r) => (
                    <MonitorQueueRow key={r.id} briefing={briefing} pRec={productsById.get(r.id)} r={r} />
                  ));

                  return [ribbon, ...bodyRows];
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
