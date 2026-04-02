// app/page.tsx
import React from "react";
import Link from "next/link";
import AirtableBriefingTools from "@/app/briefing/AirtableBriefingTools";
import {
  fetchProducts,
  ProductRecord,
  fetchDemandForYear,
  computeCategoryDemandFromYearly,
  fetchDemandForYearMonth,
  fetchSalesTotalsAllTime,
} from "@/lib/airtable";
import { formatMoneyForBrandOptional } from "@/lib/money";
import { partitionRunoutBuckets } from "@/lib/stockBriefing";

export const dynamic = "force-dynamic";

// --- helpers --------------------------------------------------

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB");
}

function daysFromToday(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  if (Number.isNaN(target)) return null;

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();

  return Math.round((target - startOfToday) / 86_400_000);
}

function daysBadge(days: number | null) {
  if (days == null) return <span className="text-slate-400">—</span>;

  const clamped = Math.max(0, Math.round(days));
  let color = "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (clamped <= 7) color = "bg-red-500/15 text-red-300 border-red-500/30";
  else if (clamped <= 30)
    color = "bg-amber-500/15 text-amber-300 border-amber-500/30";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}
      title="Estimated days of stock remaining"
    >
      {clamped}
    </span>
  );
}

function orderByClass(orderByDate: string | null) {
  const diff = daysFromToday(orderByDate);
  if (diff == null) return "text-slate-200";
  if (diff < 0) return "text-red-300";
  if (diff <= 7) return "text-amber-200";
  return "text-slate-200";
}

function runwayBar(p: ProductRecord) {
  const days = p.daysUntilRunOut ?? null;
  if (days == null) return null;

  const pct = Math.min(100, Math.max(0, (days / 30) * 100));

  let barClass = "bg-emerald-400/80";
  if (days <= 7) barClass = "bg-red-400/80";
  else if (days <= 30) barClass = "bg-amber-300/80";

  return (
    <div
      className="mt-1 h-1.5 w-full rounded-full bg-slate-800"
      title="Visual runway"
    >
      <div className={`${barClass} h-full rounded-full`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function supplierDisplay(p: ProductRecord) {
  const name = p.supplier1 || p.supplier2;
  if (!name && p.leadTimeDays == null) return <span className="text-slate-500">—</span>;

  const lead = p.leadTimeDays ?? null;
  const days = p.daysUntilRunOut ?? null;

  let icon = "🏭";
  let title = "Supplier";

  if (lead != null && days != null && lead > days) {
    icon = "⚠️";
    title = "Lead time exceeds runway — urgent!";
  } else if (lead != null) {
    icon = "🚚";
    title = "Supplier and lead time";
  }

  return (
    <span className="flex items-center gap-1.5 text-slate-100" title={title}>
      <span>{icon}</span>
      {name}
      {lead != null ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-300">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              lead != null && days != null && lead > days ? "bg-amber-400" : "bg-emerald-400"
            }`}
          />
          {lead}d
        </span>
      ) : (
        ""
      )}
    </span>
  );
}

function shopLabel(p: ProductRecord): string {
  const b = p.brand?.trim();
  return b && b.length > 0 ? b : "Unknown shop";
}

function groupRunoutByShop(
  items: ProductRecord[]
): { shop: string; items: ProductRecord[] }[] {
  const map = new Map<string, ProductRecord[]>();
  for (const p of items) {
    const shop = shopLabel(p);
    if (!map.has(shop)) map.set(shop, []);
    map.get(shop)!.push(p);
  }
  return [...map.entries()]
    .map(([shop, list]) => ({
      shop,
      items: list.sort(
        (a, b) =>
          (a.daysUntilRunOut ?? Infinity) - (b.daysUntilRunOut ?? Infinity)
      ),
    }))
    .sort((a, b) => {
      if (a.shop === "Unknown shop") return 1;
      if (b.shop === "Unknown shop") return -1;
      return a.shop.localeCompare(b.shop, "en", { sensitivity: "base" });
    });
}

function datePill(value: string | null, tone: "default" | "warn" | "danger" = "default") {
  const label = formatDate(value);
  const palette =
    tone === "danger"
      ? "bg-red-500/10 text-red-200 border-red-400/30"
      : tone === "warn"
        ? "bg-amber-500/10 text-amber-200 border-amber-400/30"
        : "bg-slate-800/80 text-slate-100 border-slate-700/80";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${palette}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current/70" />
      {label}
    </span>
  );
}

// --- main page --------------------------------------------------

type SearchParamsPromise = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParamsPromise }) {
  const sp = await searchParams;

  const products = await fetchProducts();
  const totalMap = await fetchSalesTotalsAllTime(); 

  const now = new Date();
const targetYear = now.getFullYear() - 1;
const targetMonth = now.getMonth() + 1;

const demandMap = await fetchDemandForYearMonth(targetYear, targetMonth);
const yearlyDemand = await fetchDemandForYear(targetYear);
const categoryDemand = computeCategoryDemandFromYearly(products, yearlyDemand);

  const combos = products.filter((p) => p.productType !== "Individual");
  const buckets = partitionRunoutBuckets(products);
  const {
    individuals,
    needingOrder,
    runningOut0to7,
    runningOut8to14,
    runningOut15to30,
    runningOut31to60,
  } = buckets;
  const criticalSoon = individuals.filter(
    (p) =>
      !p.excludeFromReorder &&
      p.daysUntilRunOut != null &&
      p.daysUntilRunOut <= 14
  );

  // Read view mode
  const qParam = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const sortParam = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort;
  const viewParam = Array.isArray(sp.view) ? sp.view[0] : sp.view;

  const view = viewParam || "reorder";
  const sortBy = sortParam || "orderBy";
  const query = (qParam || "").toLowerCase().trim();

  // Select which product set is shown
  let base: ProductRecord[] =
    view === "all" ? individuals : view === "combos" ? combos : needingOrder;

  // Apply search
  if (query) {
    base = base.filter((p) =>
      (p.name + " " + (p.brand ?? "")).toLowerCase().includes(query)
    );
  }

  // Sort
  const sorted = [...base].sort((a, b) => {
    if (sortBy === "daysLeft")
      return (a.daysUntilRunOut ?? Infinity) - (b.daysUntilRunOut ?? Infinity);

    if (sortBy === "qty") return b.qtyToOrder - a.qtyToOrder;
    if (sortBy === "stock") return a.currentStock - b.currentStock;

    if (sortBy === "name") {
      return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    }

    if (sortBy === "runOut") {
      const ra = a.runOutDate ? new Date(a.runOutDate).getTime() : Infinity;
      const rb = b.runOutDate ? new Date(b.runOutDate).getTime() : Infinity;
      return ra - rb;
    }

    // default: orderBy
    const oa = a.orderByDate ? new Date(a.orderByDate).getTime() : Infinity;
    const ob = b.orderByDate ? new Date(b.orderByDate).getTime() : Infinity;
    return oa - ob;
  });

  // Group by brand
  const opatra = sorted.filter((p) => (p.brand ?? "").includes("Opatra"));
  const pyt = sorted.filter((p) => (p.brand ?? "").toLowerCase().includes("pyt"));
  const others = sorted.filter((p) => !opatra.includes(p) && !pyt.includes(p));

  return (
    <main className="min-h-screen text-slate-100">
      <div className="mx-auto max-w-[90rem] px-4 py-10 space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="space-y-2 min-w-0">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300/80">Ops Control</p>
            <h1 className="text-3xl font-semibold leading-tight">Stock Runway &amp; Reorder Dashboard</h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              Live Airtable-backed view to keep runway safe and reorders timely.
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:justify-end sm:pt-1">
            <Link
              href="/briefing"
              className="h-10 inline-flex items-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-200 hover:bg-emerald-500/15"
            >
              Stock briefing
            </Link>
            <Link
              href="/buying-list"
              className="h-10 inline-flex items-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-200 hover:bg-emerald-500/15"
            >
              Buying list
            </Link>
            <Link
              href="/ops/orders"
              className="h-10 inline-flex items-center rounded-xl border border-slate-600 bg-slate-900/60 px-4 text-sm font-medium text-slate-200 hover:bg-slate-800/80"
            >
              Order progress
            </Link>
          </div>
        </header>

        {/* Detailed 60-day breakdown */}
        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Items running out in next 60 days</h2>
            <p className="text-xs text-slate-400 mt-1">
              By time bucket, grouped under each shop (Airtable Shop). Click any item for full
              details.
            </p>
          </div>

          {runningOut0to7.length > 0 && (
            <RunoutBucketByShop
              tone="critical"
              title="🔴 Critical: 0-7 days"
              items={runningOut0to7}
            />
          )}

          {runningOut8to14.length > 0 && (
            <RunoutBucketByShop
              tone="urgent"
              title="🟡 Urgent: 8-14 days"
              items={runningOut8to14}
            />
          )}

          {runningOut15to30.length > 0 && (
            <RunoutBucketByShop
              tone="watch"
              title="🔵 Watch: 15-30 days"
              items={runningOut15to30}
            />
          )}

          {runningOut31to60.length > 0 && (
            <RunoutBucketByShop
              tone="planning"
              title="⚪ Planning: 31-60 days"
              items={runningOut31to60}
            />
          )}

          {runningOut0to7.length === 0 && 
           runningOut8to14.length === 0 && 
           runningOut15to30.length === 0 && 
           runningOut31to60.length === 0 && (
            <div className="text-center py-6 text-slate-400 text-sm">
              No items running out in the next 60 days.
            </div>
          )}
        </section>

        {/* Controls */}
        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] space-y-3">
          <AirtableBriefingTools />

          {/* View switch */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">View:</span>
            {[
              { key: "reorder", label: "Reorder" },
              { key: "all", label: "All individuals" },
              { key: "combos", label: "Combos" },
            ].map((opt) => (
              <ViewButton key={opt.key} opt={opt} view={view} sortBy={sortBy} query={query} />
            ))}
          </div>

          {/* Search + Sort */}
          {/* Search + Actions + Sort */}
<div className="flex flex-col gap-4">
  {/* Top row: search + actions */}
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    {/* Search */}
    <form method="GET" className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search products"
          className="h-10 w-64 rounded-xl border border-slate-700 bg-slate-950/70 px-3 pl-9 text-sm text-slate-100 shadow-inner shadow-black/30 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        />
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
          🔍
        </span>
      </div>

      <input type="hidden" name="view" value={view} />
      <input type="hidden" name="sort" value={sortBy} />

      <button className="h-10 rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-900 hover:bg-white">
        Search
      </button>

      {query && (
        <Link
          href={`/?view=${view}&sort=${sortBy}`}
          className="h-10 inline-flex items-center rounded-xl border border-slate-700 px-3 text-sm text-slate-300 hover:bg-slate-900/60"
        >
          Clear
        </Link>
      )}
    </form>

    {/* Actions */}
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/compare"
        className="h-10 inline-flex items-center rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-slate-200 hover:bg-slate-900/60"
      >
        Compare products
      </Link>
      <Link
        href="/compare-one"
        className="h-10 inline-flex items-center rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-slate-200 hover:bg-slate-900/60"
      >
        Compare one product
      </Link>
      <Link
        href="/categories"
        className="h-10 inline-flex items-center rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-slate-200 hover:bg-slate-900/60"
      >
        Category demand
      </Link>
      <Link
        href="/master-stock"
        className="h-10 inline-flex items-center rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-slate-200 hover:bg-slate-900/60"
      >
        Master Stock
      </Link>
      <Link
        href="/diagnostics"
        className="h-10 inline-flex items-center rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-slate-200 hover:bg-slate-900/60"
      >
        System health
      </Link>
    </div>
  </div>

  {/* Bottom row: sort */}
  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
    <span>Sort:</span>
    {[
      { key: "orderBy", label: "Order by" },
      { key: "name", label: "Name (A–Z)" },
      { key: "daysLeft", label: "Days left" },
      { key: "qty", label: "Qty" },
      { key: "stock", label: "Stock" },
      { key: "runOut", label: "Run out" },
    ].map((opt) => (
      <SortButton key={opt.key} opt={opt} view={view} sortBy={sortBy} query={query} />
    ))}
  </div>
</div>

        </section>

        {/* Table */}
        <section>
          <Table
  sorted={sorted}
  opatra={opatra}
  pyt={pyt}
  others={others}
  totalsMap={totalMap}
/>

        </section>
      </div>
    </main>
  );
}

// --- Components --------------------------------------------------

type RunoutBucketTone = "critical" | "urgent" | "watch" | "planning";

function RunoutBucketByShop({
  tone,
  title,
  items,
}: {
  tone: RunoutBucketTone;
  title: string;
  items: ProductRecord[];
}) {
  const palette: Record<
    RunoutBucketTone,
    {
      wrap: string;
      h3: string;
      shop: string;
      link: string;
      name: string;
      days: string;
    }
  > = {
    critical: {
      wrap: "border-red-400/40 bg-red-500/10",
      h3: "text-red-200",
      shop: "text-red-200/70",
      link: "border-red-400/30 bg-red-500/10 hover:bg-red-500/20",
      name: "text-red-100",
      days: "text-red-200",
    },
    urgent: {
      wrap: "border-amber-400/40 bg-amber-500/10",
      h3: "text-amber-200",
      shop: "text-amber-200/70",
      link: "border-amber-400/30 bg-amber-500/10 hover:bg-amber-500/20",
      name: "text-amber-100",
      days: "text-amber-200",
    },
    watch: {
      wrap: "border-blue-400/40 bg-blue-500/10",
      h3: "text-blue-200",
      shop: "text-blue-200/70",
      link: "border-blue-400/30 bg-blue-500/10 hover:bg-blue-500/20",
      name: "text-blue-100",
      days: "text-blue-200",
    },
    planning: {
      wrap: "border-slate-600/40 bg-slate-700/10",
      h3: "text-slate-300",
      shop: "text-slate-400",
      link: "border-slate-600/30 bg-slate-700/10 hover:bg-slate-700/20",
      name: "text-slate-200",
      days: "text-slate-300",
    },
  };

  const t = palette[tone];
  const groups = groupRunoutByShop(items);
  const count = items.length;

  return (
    <div className={`rounded-xl border p-3 ${t.wrap}`}>
      <div className="mb-3">
        <h3 className={`text-sm font-semibold ${t.h3}`}>
          {title} ({count} items)
        </h3>
      </div>
      <div className="space-y-4">
        {groups.map(({ shop, items: shopItems }) => (
          <div key={shop}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${t.shop}`}>
              {shop}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {shopItems.map((p) => (
                <Link
                  key={p.id}
                  href={`/product/${p.id}`}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${t.link}`}
                >
                  <span className={`font-medium truncate min-w-0 flex-1 ${t.name}`}>{p.name}</span>
                  <span className={`tabular-nums whitespace-nowrap shrink-0 ${t.days}`}>
                    {Math.max(0, Math.round(p.daysUntilRunOut ?? 0))}d
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KPI({ 
  label, 
  value, 
  icon, 
  tone, 
  description 
}: { 
  label: string; 
  value: number; 
  icon?: string; 
  tone?: "default" | "warn";
  description?: string;
}) {
  const badge =
    tone === "warn"
      ? "bg-amber-500/15 border-amber-400/40 text-amber-100"
      : "bg-emerald-500/15 border-emerald-400/40 text-emerald-100";

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        {icon && <span className="text-lg text-slate-300">{icon}</span>}
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
      {description && (
        <p className="mt-1 text-[10px] text-slate-500">{description}</p>
      )}
      <span className={`mt-2 inline-flex w-fit rounded-full border px-2 py-1 text-[11px] ${badge}`}>
        Live
      </span>
    </div>
  );
}

function ViewButton({ opt, view, sortBy, query }: any) {
  const params = new URLSearchParams();
  params.set("view", opt.key);
  if (sortBy) params.set("sort", sortBy);
  if (query) params.set("q", query);

  const active = view === opt.key;

  return (
    <Link
      href={`/?${params.toString()}`}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100 shadow-[0_8px_24px_rgba(52,211,153,0.25)]"
          : "border-slate-700/80 bg-slate-900/70 text-slate-200 hover:border-emerald-300/40 hover:text-emerald-100"
      }`}
    >
      {opt.label}
    </Link>
  );
}

function SortButton({ opt, view, sortBy, query }: any) {
  const params = new URLSearchParams();
  params.set("sort", opt.key);
  params.set("view", view);
  if (query) params.set("q", query);

  const active = sortBy === opt.key;

  return (
    <Link
      href={`/?${params.toString()}`}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100 shadow-[0_8px_24px_rgba(52,211,153,0.25)]"
          : "border-slate-700/80 bg-slate-900/70 text-slate-200 hover:border-emerald-300/40 hover:text-emerald-100"
      }`}
    >
      {opt.label}
    </Link>
  );
}

function Table({ sorted, opatra, pyt, others, totalsMap }: any) {
  const sections = [
    { label: "Opatra", rows: opatra },
    { label: "PYT Hairstyle", rows: pyt },
    { label: "Other", rows: others },
  ];

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
        <thead className="sticky top-0 z-10 bg-slate-950/80 text-[11px] uppercase text-slate-400 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
          <tr className="border-b border-slate-800/60">
            <th className="px-4 py-3 text-left">Product</th>
            <th className="px-4 py-3 text-left hidden lg:table-cell">Brand</th>
            <th className="px-4 py-3 text-left hidden xl:table-cell">Supplier</th>

            {/* NEW totals columns */}
            <th className="px-2 py-3 text-right hidden xl:table-cell">Ind</th>
            <th className="px-2 py-3 text-right hidden xl:table-cell">Combo</th>
            <th className="px-3 py-3 text-right">Sold</th>

            <th className="px-4 py-3 text-right">Stock</th>
            <th className="px-4 py-3 text-right">Demand</th>
            <th className="px-4 py-3 text-right">Days</th>
            <th className="px-4 py-3 text-left">Run out</th>
            <th className="px-4 py-3 text-left">Order by</th>
            <th className="px-4 py-3 text-right min-w-[80px]">Qty</th>
            <th className="px-4 py-3 text-right hidden 2xl:table-cell min-w-[72px]">
              Unit
            </th>
            <th className="px-4 py-3 text-right hidden 2xl:table-cell min-w-[88px]">
              Line
            </th>

          </tr>
        </thead>

        <tbody>
          {sections.map(
            (section) =>
              section.rows.length > 0 && (
                <React.Fragment key={section.label}>
                  <tr className="bg-slate-950/80 border-t border-slate-800/70">
                    <td
                      colSpan={14}
                      className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300"
                    >
                      {section.label}
                    </td>
                  </tr>

                  {section.rows.map((p: ProductRecord) => {
                    const t = totalsMap?.get?.(p.name) ?? {
                      individual: 0,
                      combo: 0,
                      all: 0,
                    };

                    return (
                      <tr
                        key={p.id}
                        className="border-t border-slate-900/60 odd:bg-slate-900/40 even:bg-slate-900/20 hover:bg-slate-900/70 transition-colors"
                      >
                        <td className="px-4 py-3 text-slate-100 font-medium">
                          <Link
                            href={`/product/${p.id}`}
                            className="flex items-center gap-2 hover:underline"
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/80 text-xs font-semibold text-slate-200">
                              {p.brand?.slice(0, 1) ?? "•"}
                            </span>
                            {p.name}
                          </Link>
                        </td>

                        <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">
                          {p.brand}
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          {supplierDisplay(p)}
                        </td>

                        {/* NEW totals cells */}
                        <td className="px-2 py-3 text-right tabular-nums text-slate-100 hidden xl:table-cell">
                          {t.individual}
                        </td>
                        <td className="px-2 py-3 text-right tabular-nums text-slate-100 hidden xl:table-cell">
                          {t.combo}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-100 font-semibold">
                          {t.all}
                        </td>

                        <td className="px-4 py-3 text-right tabular-nums text-slate-100">
                          {p.currentStock}
                          {p.incomingStockTotal > 0 && (
                            <span className="ml-1 text-xs text-emerald-400">
                              +{p.incomingStockTotal}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right tabular-nums text-slate-100">
                          {p.totalDemandThisMonth}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {daysBadge(p.daysUntilRunOut)}
                          {runwayBar(p)}
                        </td>

                        <td className="px-4 py-3">
                          {p.runOutDate
                            ? datePill(
                                p.runOutDate,
                                p.daysUntilRunOut != null && p.daysUntilRunOut <= 7
                                  ? "warn"
                                  : "default"
                              )
                            : "—"}
                        </td>

                        <td className={`px-4 py-3 ${orderByClass(p.orderByDate)}`}>
                          {p.orderByDate
                            ? datePill(
                                p.orderByDate,
                                daysFromToday(p.orderByDate) != null &&
                                  daysFromToday(p.orderByDate)! < 0
                                  ? "danger"
                                  : "default"
                              )
                            : "—"}
                        </td>

                        <td className="px-4 py-3 text-right text-emerald-200 font-bold tabular-nums min-w-[80px]">
                          {p.qtyToOrder}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-300 hidden 2xl:table-cell">
                          {formatMoneyForBrandOptional(p.brand, p.pricePerUnit)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-200 hidden 2xl:table-cell font-medium">
                          {formatMoneyForBrandOptional(
                            p.brand,
                            p.pricePerUnit != null
                              ? p.qtyToOrder * p.pricePerUnit
                              : null
                          )}
                        </td>

                      </tr>
                    );
                  })}
                </React.Fragment>
              )
          )}

          {sorted.length === 0 && (
            <tr>
              <td colSpan={14} className="px-4 py-6 text-center text-slate-400">
                Nothing found for this view.
              </td>
            </tr>
          )}
        </tbody>
        </table>
      </div>
    </div>
  );
}

