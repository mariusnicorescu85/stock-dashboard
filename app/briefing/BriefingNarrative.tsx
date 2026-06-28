import type { BriefingRankedMonthProduct, BriefingSalesNarrative } from "@/lib/briefingSalesInsights";
import { BRIEFING_TOP_PRODUCTS } from "@/lib/briefingSalesInsights";
import { shopFilterLabel, type ShopFilter } from "@/lib/shopFilter";

function rankAccent(rank: number): { ring: string; badge: string; label: string } {
  if (rank === 1)
    return {
      ring: "border-indigo-500/35 bg-gradient-to-b from-indigo-50 to-white",
      badge: "bg-emerald-500/25 text-emerald-700 border-indigo-400/40",
      label: "text-emerald-700/90",
    };
  if (rank === 2)
    return {
      ring: "border-zinc-300 bg-zinc-50",
      badge: "bg-zinc-200 text-zinc-800 border-zinc-300",
      label: "text-zinc-600",
    };
  return {
    ring: "border-zinc-300/50 bg-white",
    badge: "bg-zinc-100 text-zinc-500 border-zinc-300/60",
    label: "text-zinc-500",
  };
}

function MonthProductCard({
  product,
  monthLabel,
}: {
  product: BriefingRankedMonthProduct;
  monthLabel: string;
}) {
  const a = rankAccent(product.rank);

  return (
    <article
      className={`rounded-2xl border p-4 shadow-[0_12px_40px_rgba(0,0,0,0.2)] flex flex-col gap-3 ${a.ring}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold tabular-nums ${a.badge}`}
          aria-label={`Rank ${product.rank}`}
        >
          {product.rank}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className={`text-sm font-semibold leading-snug ${a.label}`}>{product.productName}</h3>
          <p className="text-xs text-zinc-500">
            <span className="text-zinc-500 tabular-nums">
              {product.totalUnitsAllYears.toLocaleString("en-GB")} units
            </span>{" "}
            sold in {monthLabel} across every year we have on file
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {product.yearSeries.map((row) => (
          <span
            key={row.year}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs tabular-nums text-zinc-800"
          >
            <span className="font-medium text-zinc-500">{row.year}</span>
            <span className="text-zinc-500">·</span>
            <span>{row.units.toLocaleString("en-GB")}</span>
          </span>
        ))}
      </div>

      {product.trendSummary ? (
        <p className="text-[11px] leading-relaxed text-zinc-500 border-t border-zinc-200 pt-2">
          {product.trendSummary}
        </p>
      ) : null}
    </article>
  );
}

export default function BriefingNarrative({
  narrative,
  shop,
}: {
  narrative: BriefingSalesNarrative;
  shop: ShopFilter;
}) {
  const scope = shopFilterLabel(shop);
  const { monthLabel, yearsPresent, shopBlocks, reorderGuidance } = narrative;

  function formatYearsSummary(years: number[]): string {
    if (years.length === 0) return "no years yet";
    if (years.length === 1) return String(years[0]);
    const consecutive = years.every((y, i) => i === 0 || y === years[i - 1] + 1);
    if (consecutive) {
      return `${years[0]}–${years[years.length - 1]} (${years.length} years)`;
    }
    if (years.length <= 8) {
      return `${years.join(", ")} (${years.length} years)`;
    }
    return `${years[0]} … ${years[years.length - 1]} (${years.length} calendar years — not all consecutive)`;
  }

  const yearsLabel = formatYearsSummary(yearsPresent);

  return (
    <div className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-50 via-white to-zinc-50 p-5 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Sales snapshot
        </p>
        <p className="text-xs text-zinc-500">
          Showing: <span className="text-zinc-500">{scope}</span>
        </p>
      </div>

      <div className="space-y-4 text-sm text-zinc-800 leading-relaxed">
        <p className="text-zinc-500 text-xs">
          We use <span className="text-zinc-600">{monthLabel}</span> because that matches the month
          you opened this page (when April starts, this block switches to April). Sales history spans{" "}
          <span className="text-zinc-600 tabular-nums">{yearsLabel}</span>
          {yearsPresent.length > 0 ? " for that month" : ""}. The current year may still be
          incomplete until your monthly numbers are updated. The top {BRIEFING_TOP_PRODUCTS} products
          per shop are the ones that sold the most units in that month when you add up every year on
          record.
        </p>

        {shopBlocks.length === 0 ? (
          <p className="text-zinc-500">
            {yearsPresent.length === 0
              ? `We don’t have any sales recorded for ${monthLabel} yet — or everything is zero — so there’s nothing to rank here.`
              : "We couldn’t match products to sales for this view — names in stock may not match names in your sales history."}
          </p>
        ) : (
          shopBlocks.map((b) => (
            <div
              key={b.shopKey}
              className="rounded-xl border border-zinc-300/50 bg-zinc-50 px-4 py-4 space-y-4"
            >
              <p className="text-xs font-medium text-emerald-700/90">{b.shopLabel}</p>
              <p className="text-xs text-zinc-500">
                Best sellers in <span className="text-zinc-500">{monthLabel}</span> (up to{" "}
                {BRIEFING_TOP_PRODUCTS} products per shop).
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {b.topProducts.map((prod) => (
                  <MonthProductCard key={prod.productName} product={prod} monthLabel={monthLabel} />
                ))}
              </div>
            </div>
          ))
        )}

        <p className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-zinc-800">
          <span className="font-medium text-amber-800/95">What to buy: </span>
          {reorderGuidance}
        </p>
      </div>
    </div>
  );
}
