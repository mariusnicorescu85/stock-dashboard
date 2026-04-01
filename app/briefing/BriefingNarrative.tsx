import type { BriefingRankedMonthProduct, BriefingSalesNarrative } from "@/lib/briefingSalesInsights";
import { BRIEFING_TOP_PRODUCTS } from "@/lib/briefingSalesInsights";
import { shopFilterLabel, type ShopFilter } from "@/lib/shopFilter";

function rankAccent(rank: number): { ring: string; badge: string; label: string } {
  if (rank === 1)
    return {
      ring: "border-emerald-500/35 bg-gradient-to-b from-emerald-500/[0.15] to-slate-950/60",
      badge: "bg-emerald-500/25 text-emerald-200 border-emerald-400/40",
      label: "text-emerald-200/90",
    };
  if (rank === 2)
    return {
      ring: "border-slate-500/35 bg-slate-900/70",
      badge: "bg-slate-600/40 text-slate-200 border-slate-500/35",
      label: "text-slate-300",
    };
  return {
    ring: "border-slate-700/50 bg-slate-950/70",
    badge: "bg-slate-800/80 text-slate-400 border-slate-600/30",
    label: "text-slate-400",
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
          <p className="text-xs text-slate-500">
            <span className="text-slate-400 tabular-nums">
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/50 px-2.5 py-1 text-xs tabular-nums text-slate-200"
          >
            <span className="font-medium text-slate-400">{row.year}</span>
            <span className="text-slate-500">·</span>
            <span>{row.units.toLocaleString("en-GB")}</span>
          </span>
        ))}
      </div>

      {product.trendSummary ? (
        <p className="text-[11px] leading-relaxed text-slate-500 border-t border-slate-800/60 pt-2">
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
    <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/40 via-slate-900/50 to-slate-950/80 p-5 space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
          Sales snapshot
        </p>
        <p className="text-xs text-slate-500">
          Showing: <span className="text-slate-400">{scope}</span>
        </p>
      </div>

      <div className="space-y-4 text-sm text-slate-200 leading-relaxed">
        <p className="text-slate-400 text-xs">
          We use <span className="text-slate-300">{monthLabel}</span> because that matches the month
          you opened this page (when April starts, this block switches to April). Sales history spans{" "}
          <span className="text-slate-300 tabular-nums">{yearsLabel}</span>
          {yearsPresent.length > 0 ? " for that month" : ""}. The current year may still be
          incomplete until your monthly numbers are updated. The top {BRIEFING_TOP_PRODUCTS} products
          per shop are the ones that sold the most units in that month when you add up every year on
          record.
        </p>

        {shopBlocks.length === 0 ? (
          <p className="text-slate-500">
            {yearsPresent.length === 0
              ? `We don’t have any sales recorded for ${monthLabel} yet — or everything is zero — so there’s nothing to rank here.`
              : "We couldn’t match products to sales for this view — names in stock may not match names in your sales history."}
          </p>
        ) : (
          shopBlocks.map((b) => (
            <div
              key={b.shopKey}
              className="rounded-xl border border-slate-700/50 bg-slate-950/40 px-4 py-4 space-y-4"
            >
              <p className="text-xs font-medium text-emerald-200/90">{b.shopLabel}</p>
              <p className="text-xs text-slate-500">
                Best sellers in <span className="text-slate-400">{monthLabel}</span> (up to{" "}
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

        <p className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-slate-200">
          <span className="font-medium text-amber-100/95">What to buy: </span>
          {reorderGuidance}
        </p>
      </div>
    </div>
  );
}
