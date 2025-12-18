// app/compare-one/page.tsx
import Link from "next/link";
import { fetchProducts, fetchMonthlySalesForProduct } from "@/lib/airtable";
import CompareOneForm from "./CompareOneForm";

export const dynamic = "force-dynamic";

function ymKey(monthStart: string | null) {
  if (!monthStart) return null;
  const d = new Date(monthStart);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function labelToName(recordLabel: string) {
  // "2024-12 - Butter" or "2024-12 – Butter" -> "Butter"
  return recordLabel.replace(/^\d{4}-\d{2}\s*[–-]\s*/u, "").trim();
}

function formatYM(ym: string) {
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
}

function isPromise(x: any): x is Promise<any> {
  return x && typeof x.then === "function";
}

export default async function CompareOnePage(props: {
  searchParams?:
    | Promise<{ p?: string; m?: string | string[] }>
    | { p?: string; m?: string | string[] };
}) {
  const sp = props.searchParams
    ? isPromise(props.searchParams)
      ? await props.searchParams
      : props.searchParams
    : {};

  const products = await fetchProducts();

  const productId = sp.p ?? "";
  const product = products.find((x) => x.id === productId) ?? null;

  const sales = product ? await fetchMonthlySalesForProduct(product.name) : [];

  // Individual-only (exclude combos) by exact label name match
  const filteredSales = product
    ? sales.filter(
        (s) =>
          labelToName(s.label).toLowerCase() === product.name.toLowerCase()
      )
    : [];

  // Aggregate totals per YYYY-MM
  const byYM = new Map<string, number>();
  for (const r of filteredSales) {
    const k = ymKey(r.monthStart);
    if (!k) continue;
    byYM.set(k, (byYM.get(k) ?? 0) + (r.unitsSold ?? 0));
  }

  const monthsAvailable = Array.from(byYM.keys()).sort(); // oldest -> newest

  // Selected months from query (?m=2024-01&m=2024-02...) or (?m=all)
  const mRaw = sp.m;
  let selected: string[] =
    typeof mRaw === "string"
      ? [mRaw]
      : Array.isArray(mRaw)
      ? mRaw
      : [];

  // Support ?m=all
  const wantsAll = selected.includes("all");
  if (wantsAll) selected = monthsAvailable;

  // Support ?m=last12
  const wantsLast12 = selected.includes("last12");
  if (wantsLast12) selected = monthsAvailable.slice(-12);

  // Keep only valid months and sort in chronological order
  const selectedMonths = selected
    .filter((m) => monthsAvailable.includes(m))
    .sort();

  const rows = selectedMonths.map((m, idx) => {
    const units = byYM.get(m) ?? 0;
    const prevM = idx > 0 ? selectedMonths[idx - 1] : null;
    const prevUnits = prevM ? byYM.get(prevM) ?? 0 : null;
    const diff = prevUnits == null ? null : units - prevUnits;
    const pct =
      prevUnits != null && prevUnits > 0 ? (diff! / prevUnits) * 100 : null;

    return { m, units, diff, pct };
  });

  const totalSelected = rows.reduce((sum, r) => sum + r.units, 0);
  const avgSelected =
    rows.length > 0 ? totalSelected / rows.length : null;

  const allLink = product
    ? `/compare-one?p=${product.id}&m=all`
    : "/compare-one";

  const last12Link = product
    ? `/compare-one?p=${product.id}&m=last12`
    : "/compare-one";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Compare one product across months
            </h1>
            <p className="text-sm text-slate-400">
              Select a product, then select any number of months.
              <span className="ml-2 text-slate-500">
                (Hold Ctrl/⌘ to pick multiple)
              </span>
            </p>
          </div>
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
            ← Back to dashboard
          </Link>
        </div>

        {/* Controls */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
          <CompareOneForm
  products={products}
  productId={productId}
  monthsAvailable={monthsAvailable}
  selectedMonths={selectedMonths}
/>


          {product && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Selected months
                </p>
                <p className="mt-2 text-2xl font-semibold">{rows.length}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Total units (selected)
                </p>
                <p className="mt-2 text-2xl font-semibold">{totalSelected}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Avg units / month
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {avgSelected == null ? "—" : Math.round(avgSelected)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {!product ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-slate-300">
            Select a product to begin.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2 text-right">Units sold</th>
                  <th className="px-3 py-2 text-right">Diff vs prev</th>
                  <th className="px-3 py-2 text-right">% vs prev</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.m} className="border-t border-slate-800/70">
                    <td className="px-3 py-2">{formatYM(r.m)}</td>
                    <td className="px-3 py-2 text-right">{r.units}</td>
                    <td className="px-3 py-2 text-right">
                      {r.diff == null ? "—" : r.diff > 0 ? `+${r.diff}` : r.diff}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">
                      {r.pct == null ? "—" : `${r.pct.toFixed(0)}%`}
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                      Select one or more months to compare.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
