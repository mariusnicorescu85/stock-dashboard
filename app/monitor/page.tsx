import Link from "next/link";
import { fetchProducts } from "@/lib/airtable";
import { filterProductsByShop, parseShopFilter, shopFilterLabel } from "@/lib/shopFilter";
import {
  buildStockBriefingFromBuckets,
  partitionRunoutBuckets,
} from "@/lib/stockBriefing";
import MonitorPanel from "./MonitorPanel";
import MonitorShopSelect from "./MonitorShopSelect";

export const dynamic = "force-dynamic";

type SearchParamsPromise = Promise<Record<string, string | string[] | undefined>>;

export default async function MonitorPage({
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

  const scopeLabel = shopFilterLabel(shop);

  const subtleLink =
    "text-sm font-medium text-zinc-500 underline-offset-4 decoration-zinc-400 hover:text-zinc-800 hover:decoration-zinc-500 transition-colors";
  const focusLink =
    "text-sm font-semibold text-indigo-600 underline underline-offset-4 decoration-indigo-400/50 hover:text-indigo-500";

  return (
    <main className="min-h-screen w-full bg-white text-zinc-900 antialiased">
      <div className="w-full px-5 pb-14 pt-8 sm:px-8 lg:px-12">
        <header className="mb-10 w-full border-b border-zinc-200 pb-8">
          <div className="grid w-full gap-y-8 gap-x-12 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start xl:gap-y-6">
            <div className="min-w-0 space-y-2 xl:max-w-2xl">
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-[2rem]">
                Stock monitor
              </h1>
              <p className="max-w-none text-[15px] leading-relaxed text-zinc-500">
                <span className="font-medium text-zinc-600">{scopeLabel}</span>
                {" — "}
                <span className="text-zinc-500">
                  Same queue as briefing — urgency, run‑out, planner qty, min‑order stress test.
                </span>
              </p>
            </div>
            {/* ml-auto pins this row to the right when stacked (1 col); xl: second grid column sticks right */}
            <nav
              className="ml-auto flex w-max max-w-[calc(100vw_-_2.5rem)] shrink-0 flex-wrap items-center justify-end gap-x-10 gap-y-4 text-sm sm:flex-nowrap sm:gap-x-12 xl:ml-0 xl:justify-self-end"
              aria-label="Monitor shortcuts"
            >
              <div className="flex items-center gap-2 whitespace-nowrap px-2">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Shop</span>
                <MonitorShopSelect shop={shop} />
              </div>
              <Link
                href={`/briefing${shop !== "all" ? `?shop=${shop}` : ""}`}
                className={`${subtleLink} whitespace-nowrap px-2`}
              >
                Briefing
              </Link>
              <Link href="/" className={`${subtleLink} whitespace-nowrap px-2`}>
                Dashboard
              </Link>
              <Link
                href={shop === "all" ? "/buying-list" : `/buying-list?shop=${shop}`}
                className={`${focusLink} whitespace-nowrap px-2`}
              >
                Buying list
              </Link>
            </nav>
          </div>
        </header>

        <MonitorPanel briefing={briefing} shop={shop} products={scoped} />
      </div>
    </main>
  );
}
