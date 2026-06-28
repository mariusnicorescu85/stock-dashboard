import Link from "next/link";
import type { ProductRecord } from "@/lib/airtable";
import { formatReorderTotalsEurUsd } from "@/lib/money";
import type { StockBriefing } from "@/lib/stockBriefing";
import { shopFilterLabel, type ShopFilter } from "@/lib/shopFilter";
import MonitorReplenishmentQueue from "./MonitorReplenishmentQueue";

export default function MonitorPanel({
  briefing,
  products,
  shop,
}: {
  briefing: StockBriefing;
  products: ProductRecord[];
  shop: ShopFilter;
}) {
  const rows = briefing.topReorders;

  const orderValueTotals =
    briefing.reorderOrderValueEur > 0 || briefing.reorderOrderValueUsd > 0
      ? formatReorderTotalsEurUsd(briefing.reorderOrderValueEur, briefing.reorderOrderValueUsd)
      : null;

  const buyingHref = shop === "all" ? "/buying-list" : `/buying-list?shop=${shop}`;

  return (
    <div className="w-full space-y-10">
      {/* Full-width top band — stats spread horizontally on large screens */}
      <section className="w-full rounded-xl border border-zinc-200 bg-zinc-50/35 px-4 py-8 sm:px-8 lg:px-12 lg:py-9">
        <div className="flex w-full flex-col gap-12 xl:flex-row xl:items-stretch xl:justify-between xl:gap-14 2xl:gap-24">
          <div className="flex min-w-0 flex-[1.05] flex-col justify-center gap-8">
            {/* Explicit grid avoids flex quirks where captions/values can visually merge */}
            <div className="grid min-w-0 grid-cols-1 gap-x-12 gap-y-10 border-b border-zinc-200 pb-10 sm:grid-cols-2 sm:gap-y-8 sm:border-0 sm:pb-0">
              <div className="min-w-0 sm:border-r sm:border-zinc-200 sm:pr-10">
                <div className="space-y-1.5">
                  <p className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Lines to order
                  </p>
                  <p className="text-lg font-semibold tabular-nums tracking-tight text-zinc-900 sm:text-xl">
                    {rows.length}
                  </p>
                </div>
              </div>
              <div className="min-w-0 sm:pl-0">
                <div className="space-y-1.5">
                  <p className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Suggested units
                  </p>
                  <p className="text-lg font-semibold tabular-nums tracking-tight text-indigo-600 sm:text-xl">
                    ~{briefing.totalUnitsToOrder.toLocaleString("en-GB")}
                  </p>
                </div>
              </div>
            </div>
            {(orderValueTotals || briefing.reorderSkusWithoutUnitPrice > 0) && (
              <div className="space-y-5 border-t border-zinc-200 pt-8">
                {orderValueTotals ? (
                  <div className="space-y-1.5">
                    <p className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Estimated value
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-zinc-900 sm:text-xl">
                      ~ {orderValueTotals}
                    </p>
                  </div>
                ) : null}
                {briefing.reorderSkusWithoutUnitPrice > 0 ? (
                  <p className="max-w-xl text-[13px] leading-relaxed text-amber-700/90">
                    {briefing.reorderSkusWithoutUnitPrice} lines missing unit price · not counted in rollup
                  </p>
                ) : null}
              </div>
            )}
            <p className="text-[13px] leading-relaxed text-zinc-500 sm:mt-1">{briefing.dateLabel}</p>
          </div>

          <div className="hidden h-auto w-px shrink-0 bg-zinc-100 xl:block" aria-hidden />

          <div className="flex min-w-0 flex-1 flex-col justify-center border-t border-zinc-200 pt-10 xl:border-t-0 xl:pt-0 xl:max-w-none">
            <p className="mb-8 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Runway mix
            </p>
            <ul
              className="flex w-full list-none flex-col gap-7 pl-0 text-[13px] sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-4 lg:justify-between xl:gap-x-10 2xl:gap-x-16"
              role="list"
            >
              <li className="flex min-w-[7rem] max-w-[11rem] flex-col gap-1.5 xl:text-center">
                <span className="text-lg font-semibold tabular-nums text-rose-200 sm:text-xl">{briefing.critical0to7}</span>
                <span className="leading-snug text-zinc-500">within ~7 days</span>
              </li>
              <li className="flex min-w-[7rem] max-w-[11rem] flex-col gap-1.5 xl:text-center">
                <span className="text-lg font-semibold tabular-nums text-amber-700 sm:text-xl">{briefing.urgent8to14}</span>
                <span className="leading-snug text-zinc-500">~8–14 days</span>
              </li>
              <li className="flex min-w-[7rem] max-w-[11rem] flex-col gap-1.5 xl:text-center">
                <span className="text-lg font-semibold tabular-nums text-sky-200 sm:text-xl">{briefing.watch15to30}</span>
                <span className="leading-snug text-zinc-500">~15–30 days</span>
              </li>
              <li className="flex min-w-[7rem] max-w-[11rem] flex-col gap-1.5 xl:text-center">
                <span className="text-lg font-semibold tabular-nums text-zinc-800 sm:text-xl">{briefing.planning31to60}</span>
                <span className="leading-snug text-zinc-500">~31–60 days</span>
              </li>
            </ul>
          </div>

          <div className="flex shrink-0 flex-col items-stretch justify-center gap-6 border-t border-zinc-200 pt-6 sm:flex-row sm:items-center sm:border-t-0 sm:pt-0 xl:w-auto xl:flex-col xl:items-end xl:border-l xl:border-zinc-200 xl:border-t-0 xl:pl-10 2xl:pl-14">
            <Link
              href={buyingHref}
              className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-indigo-600 px-8 py-3.5 text-[15px] font-semibold text-white transition hover:bg-indigo-500 xl:w-auto"
            >
              Open buying list<span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Table: no enclosing card */}
      <div>
        <h2 className="sr-only">Replenishment queue</h2>

        {rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-500">
            <p>
              No lines for <span className="font-medium text-zinc-600">{shopFilterLabel(shop)}</span>.
            </p>
            {shop !== "all" ? (
              <Link href="/monitor" className="mt-3 inline-block text-indigo-600 hover:text-indigo-500">
                Show all shops
              </Link>
            ) : null}
          </div>
        ) : (
          <MonitorReplenishmentQueue briefing={briefing} products={products} rows={rows} />
        )}

        <p className="mt-6 max-w-3xl text-[11px] leading-relaxed text-zinc-500">
          Run-out dates and minimum-buy cover are illustrative (incoming counted in totals). Tune buffer with{" "}
          <code className="rounded bg-zinc-50 px-1 font-mono text-zinc-500">STOCK_COVER_BUFFER_DAYS</code>.
          <span className="mt-1 block text-zinc-500">
            Category view groups rows by the Airtable <span className="font-mono text-zinc-500">Category</span> field.
            Each category band shows the <span className="text-zinc-500">soonest runway</span> among lines in that
            group.
            <span className="mt-1 block">
              <span className="text-zinc-500">Est. arrival*</span> is approximate: today plus Airtable lead time
              (calendar days).
            </span>
          </span>
        </p>
      </div>
    </div>
  );
}
