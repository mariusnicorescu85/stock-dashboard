// app/page.tsx
import React from "react";
import Link from "next/link";
import {
  fetchProducts,
  ProductRecord,
  fetchDemandForYear,
  computeCategoryDemandFromYearly,
  fetchDemandForYearMonth,
  fetchSalesTotalsAllTime,
} from "@/lib/airtable";

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

  const individuals = products.filter((p) => p.productType === "Individual");
  const combos = products.filter((p) => p.productType !== "Individual");

  const needingOrder = individuals.filter((p) => p.qtyToOrder > 0);

  const criticalSoon = individuals.filter(
    (p) => p.daysUntilRunOut != null && p.daysUntilRunOut <= 14
  );

  const totalUnitsToOrder = needingOrder.reduce((sum, p) => sum + p.qtyToOrder, 0);

  // Breakdown by time buckets for next 60 days
  const runningOut0to7 = individuals.filter(
    (p) => p.daysUntilRunOut != null && p.daysUntilRunOut >= 0 && p.daysUntilRunOut <= 7
  );
  const runningOut8to14 = individuals.filter(
    (p) => p.daysUntilRunOut != null && p.daysUntilRunOut > 7 && p.daysUntilRunOut <= 14
  );
  const runningOut15to30 = individuals.filter(
    (p) => p.daysUntilRunOut != null && p.daysUntilRunOut > 14 && p.daysUntilRunOut <= 30
  );
  const runningOut31to60 = individuals.filter(
    (p) => p.daysUntilRunOut != null && p.daysUntilRunOut > 30 && p.daysUntilRunOut <= 60
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
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-8">
        {/* Header */}
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-300/80">Ops Control</p>
          <h1 className="text-3xl font-semibold leading-tight">Stock Runway &amp; Reorder Dashboard</h1>
          <p className="text-sm text-slate-400">Live Airtable-backed view to keep runway safe and reorders timely.</p>
        </header>
        


        {/* Detailed 60-day breakdown */}
        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Items running out in next 60 days</h2>
            <p className="text-xs text-slate-400 mt-1">
              Detailed breakdown by time buckets. Click any item to see full details.
            </p>
          </div>

          {/* 0-7 days */}
          {runningOut0to7.length > 0 && (
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-red-200">
                  🔴 Critical: 0-7 days ({runningOut0to7.length} items)
                </h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {runningOut0to7
                  .sort((a, b) => (a.daysUntilRunOut ?? Infinity) - (b.daysUntilRunOut ?? Infinity))
                  .map((p) => (
                    <Link
                      key={p.id}
                      href={`/product/${p.id}`}
                      className="flex items-center justify-between rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs hover:bg-red-500/20 transition-colors"
                    >
                      <span className="text-red-100 font-medium truncate flex-1">{p.name}</span>
                      <span className="ml-2 text-red-200 tabular-nums whitespace-nowrap">
                        {Math.max(0, Math.round(p.daysUntilRunOut ?? 0))}d
                      </span>
                    </Link>
                  ))}
              </div>
            </div>
          )}

          {/* 8-14 days */}
          {runningOut8to14.length > 0 && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-amber-200">
                  🟡 Urgent: 8-14 days ({runningOut8to14.length} items)
                </h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {runningOut8to14
                  .sort((a, b) => (a.daysUntilRunOut ?? Infinity) - (b.daysUntilRunOut ?? Infinity))
                  .map((p) => (
                    <Link
                      key={p.id}
                      href={`/product/${p.id}`}
                      className="flex items-center justify-between rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs hover:bg-amber-500/20 transition-colors"
                    >
                      <span className="text-amber-100 font-medium truncate flex-1">{p.name}</span>
                      <span className="ml-2 text-amber-200 tabular-nums whitespace-nowrap">
                        {Math.max(0, Math.round(p.daysUntilRunOut ?? 0))}d
                      </span>
                    </Link>
                  ))}
              </div>
            </div>
          )}

          {/* 15-30 days */}
          {runningOut15to30.length > 0 && (
            <div className="rounded-xl border border-blue-400/40 bg-blue-500/10 p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-blue-200">
                  🔵 Watch: 15-30 days ({runningOut15to30.length} items)
                </h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {runningOut15to30
                  .sort((a, b) => (a.daysUntilRunOut ?? Infinity) - (b.daysUntilRunOut ?? Infinity))
                  .map((p) => (
                    <Link
                      key={p.id}
                      href={`/product/${p.id}`}
                      className="flex items-center justify-between rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs hover:bg-blue-500/20 transition-colors"
                    >
                      <span className="text-blue-100 font-medium truncate flex-1">{p.name}</span>
                      <span className="ml-2 text-blue-200 tabular-nums whitespace-nowrap">
                        {Math.max(0, Math.round(p.daysUntilRunOut ?? 0))}d
                      </span>
                    </Link>
                  ))}
              </div>
            </div>
          )}

          {/* 31-60 days */}
          {runningOut31to60.length > 0 && (
            <div className="rounded-xl border border-slate-600/40 bg-slate-700/10 p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-300">
                  ⚪ Planning: 31-60 days ({runningOut31to60.length} items)
                </h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {runningOut31to60
                  .sort((a, b) => (a.daysUntilRunOut ?? Infinity) - (b.daysUntilRunOut ?? Infinity))
                  .map((p) => (
                    <Link
                      key={p.id}
                      href={`/product/${p.id}`}
                      className="flex items-center justify-between rounded-lg border border-slate-600/30 bg-slate-700/10 px-3 py-2 text-xs hover:bg-slate-700/20 transition-colors"
                    >
                      <span className="text-slate-200 font-medium truncate flex-1">{p.name}</span>
                      <span className="ml-2 text-slate-300 tabular-nums whitespace-nowrap">
                        {Math.max(0, Math.round(p.daysUntilRunOut ?? 0))}d
                      </span>
                    </Link>
                  ))}
              </div>
            </div>
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

          </tr>
        </thead>

        <tbody>
          {sections.map(
            (section) =>
              section.rows.length > 0 && (
                <React.Fragment key={section.label}>
                  <tr className="bg-slate-950/80 border-t border-slate-800/70">
                    <td
                      colSpan={13}
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

                        <td className="px-4 py-3 text-right text-emerald-300 font-semibold min-w-[80px]">
  {p.qtyToOrder}
</td>

                      </tr>
                    );
                  })}
                </React.Fragment>
              )
          )}

          {sorted.length === 0 && (
            <tr>
              <td colSpan={13} className="px-4 py-6 text-center text-slate-400">
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

