import Link from "next/link";
import { fetchProducts } from "@/lib/airtable";
import {
  buildStockBriefingFromBuckets,
  partitionRunoutBuckets,
} from "@/lib/stockBriefing";
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[90rem] px-4 py-10 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300/80">Ops Control</p>
            <h1 className="text-3xl font-semibold leading-tight">Stock briefing</h1>
            <p className="text-sm text-slate-400 max-w-xl">
              Runway buckets and full reorder queue for{" "}
              <span className="text-slate-200">{shopFilterLabel(shop)}</span>. Choose a shop below
              or view everything.
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

        <StockBriefingPanel briefing={briefing} shop={shop} />
      </div>
    </main>
  );
}
