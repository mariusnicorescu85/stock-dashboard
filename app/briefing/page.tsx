import Link from "next/link";
import {
  computeBriefingBaselineDelta,
  fetchBriefingBaselineSnapshot,
} from "@/lib/briefingBaselineAirtable";
import { buildBriefingDecisions } from "@/lib/briefingDecisions";
import { buildBriefingSalesNarrative, briefingSameMonthWindow } from "@/lib/briefingSalesInsights";
import { fetchDemandForMonthAllYears, fetchProducts } from "@/lib/airtable";
import {
  buildStockBriefingFromBuckets,
  partitionRunoutBuckets,
} from "@/lib/stockBriefing";
import {
  buildBriefingNarrationPayload,
  fetchBriefingNarrationOpenAI,
} from "@/lib/briefingNarrationOpenAI";
import { filterProductsByShop, parseShopFilter, shopFilterLabel } from "@/lib/shopFilter";
import BriefingShopSelect from "./BriefingShopSelect";
import StockBriefingPanel from "./StockBriefingPanel";

export const dynamic = "force-dynamic";

type SearchParamsPromise = Promise<Record<string, string | string[] | undefined>>;

export default async function BriefingPage({
  searchParams,
}: {
  searchParams: SearchParamsPromise;
}) {
  const sp = await searchParams;
  const shop = parseShopFilter(sp.shop);

  const allProducts = await fetchProducts();
  const scoped = filterProductsByShop(allProducts, shop);
  const buckets = partitionRunoutBuckets(scoped);
  const briefing = buildStockBriefingFromBuckets(buckets);

  const { month, monthLabel } = briefingSameMonthWindow(new Date());
  const demandByYear = await fetchDemandForMonthAllYears(month);
  const salesNarrative = buildBriefingSalesNarrative({
    allProducts,
    briefing,
    shop,
    demandByYear,
    month,
    monthLabel,
  });

  const decisions = buildBriefingDecisions({
    briefing,
    scopedProducts: scoped,
    salesNarrative,
    shop,
  });

  const narrationPayload = buildBriefingNarrationPayload(
    briefing,
    decisions,
    shopFilterLabel(shop),
    salesNarrative
  );
  const aiNarration = await fetchBriefingNarrationOpenAI(narrationPayload);

  const baselineSnapshot = await fetchBriefingBaselineSnapshot();
  const baselineDelta =
    shop === "all"
      ? computeBriefingBaselineDelta(baselineSnapshot, briefing)
      : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[90rem] px-4 py-10 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300/80">Ops Control</p>
            <h1 className="text-3xl font-semibold leading-tight">Stock briefing</h1>
            <p className="text-sm text-slate-400 max-w-xl">
              See what’s running low, what to order, and how your best sellers are doing — for{" "}
              <span className="text-slate-200">{shopFilterLabel(shop)}</span> or the whole business.
              Pick a shop below or leave it on “all”.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <BriefingShopSelect shop={shop} />
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-xl border border-slate-600 bg-slate-900/60 px-3 text-sm text-slate-200 hover:bg-slate-800/80"
            >
              ← Dashboard
            </Link>
          </div>
        </header>

        <StockBriefingPanel
          briefing={briefing}
          shop={shop}
          salesNarrative={salesNarrative}
          decisions={decisions}
          aiNarration={aiNarration}
          baselineDelta={baselineDelta}
        />
      </div>
    </main>
  );
}
