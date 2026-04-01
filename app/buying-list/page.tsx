import Link from "next/link";
import { fetchProducts } from "@/lib/airtable";
import { filterProductsByShop, parseShopFilter, shopFilterLabel } from "@/lib/shopFilter";
import { partitionRunoutBuckets } from "@/lib/stockBriefing";
import type { BuyingListRow } from "@/lib/buyingListCsv";
import BuyingListClient from "./BuyingListClient";
import BuyingListShopSelect from "./BuyingListShopSelect";

export const dynamic = "force-dynamic";

type SearchParamsPromise = Promise<Record<string, string | string[] | undefined>>;

function parseOrderByMs(orderByDate: string | null): number {
  if (!orderByDate) return Infinity;
  const t = new Date(orderByDate).getTime();
  return Number.isNaN(t) ? Infinity : t;
}

export default async function BuyingListPage({
  searchParams,
}: {
  searchParams: SearchParamsPromise;
}) {
  const sp = await searchParams;
  const shop = parseShopFilter(sp.shop);

  const allProducts = await fetchProducts();
  const scoped = filterProductsByShop(allProducts, shop);
  const { needingOrder } = partitionRunoutBuckets(scoped);

  const sorted = [...needingOrder].sort(
    (a, b) => parseOrderByMs(a.orderByDate) - parseOrderByMs(b.orderByDate)
  );

  const rows: BuyingListRow[] = sorted.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand ?? null,
    qtyToOrder: p.qtyToOrder,
    pricePerUnit: p.pricePerUnit,
    purchaseCurrency: p.purchaseCurrency,
    orderByDate: p.orderByDate,
    airtableTable: p.airtableTable,
  }));

  const dateLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const scope = shopFilterLabel(shop);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[90rem] px-4 py-10 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300/80">Ops Control</p>
            <h1 className="text-3xl font-semibold leading-tight">Buying list</h1>
            <p className="text-sm text-slate-400 max-w-xl">
              Lines that need ordering for{" "}
              <span className="text-slate-200">{scope}</span>, sorted by order-by date. Adjust quantities, then
              export or email.
            </p>
            <p className="text-xs text-slate-500">{dateLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <BuyingListShopSelect shop={shop} />
            <Link
              href="/briefing"
              className="h-10 inline-flex items-center rounded-xl border border-slate-600 bg-slate-900/60 px-3 text-sm text-slate-200 hover:bg-slate-800/80"
            >
              ← Stock briefing
            </Link>
            <Link
              href="/?view=reorder&sort=orderBy"
              className="h-10 inline-flex items-center rounded-xl border border-slate-600 bg-slate-900/60 px-3 text-sm text-slate-200 hover:bg-slate-800/80"
            >
              Full dashboard
            </Link>
          </div>
        </header>

        <BuyingListClient rows={rows} shopLabel={scope} dateLabel={dateLabel} />
      </div>
    </main>
  );
}
