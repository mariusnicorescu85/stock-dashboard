// app/compare/page.tsx
import Link from "next/link";
import { fetchProducts, fetchMonthlySalesForProduct } from "@/lib/airtable";

export const dynamic = "force-dynamic";

function ymKey(monthStart: string | null) {
  if (!monthStart) return null;
  const d = new Date(monthStart);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatYM(ym: string) {
  const [y, m] = ym.split("-");
  return `${m}/${y}`; // MM/YYYY
}

export default async function ComparePage(props: {
  searchParams?: Promise<{ a?: string; b?: string }> | { a?: string; b?: string };
}) {
  // Next 16 can provide searchParams as a Promise in some cases
  const sp =
    props.searchParams && typeof (props.searchParams as any).then === "function"
      ? await (props.searchParams as Promise<{ a?: string; b?: string }>)
      : ((props.searchParams as { a?: string; b?: string }) ?? {});

  const products = await fetchProducts();

  const aId = sp.a ?? "";
  const bId = sp.b ?? "";

  const productA = products.find((p) => p.id === aId) ?? null;
  const productB = products.find((p) => p.id === bId) ?? null;

  const [salesA, salesB] = await Promise.all([
    productA ? fetchMonthlySalesForProduct(productA.name) : Promise.resolve([]),
    productB ? fetchMonthlySalesForProduct(productB.name) : Promise.resolve([]),
  ]);

  const mapA = new Map<string, number>();
  for (const r of salesA) {
    const k = ymKey(r.monthStart);
    if (!k) continue;
    mapA.set(k, (mapA.get(k) ?? 0) + (r.unitsSold ?? 0));
  }

  const mapB = new Map<string, number>();
  for (const r of salesB) {
    const k = ymKey(r.monthStart);
    if (!k) continue;
    mapB.set(k, (mapB.get(k) ?? 0) + (r.unitsSold ?? 0));
  }

  const months = Array.from(new Set([...mapA.keys(), ...mapB.keys()])).sort();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Compare monthly sales</h1>
            <p className="text-sm text-slate-400">
              Choose two products to compare units sold by month.
            </p>
          </div>
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
            ← Back to dashboard
          </Link>
        </div>

        <form className="grid gap-3 sm:grid-cols-3" method="get">
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Product A
            </label>
            <select
              name="a"
              defaultValue={aId}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm"
            >
              <option value="">— Select —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.brand ?? "—"})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Product B
            </label>
            <select
              name="b"
              defaultValue={bId}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm"
            >
              <option value="">— Select —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.brand ?? "—"})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button className="w-full rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-white">
              Compare
            </button>
          </div>
        </form>

        {!productA || !productB ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-slate-300">
            Select two products and click{" "}
            <span className="font-semibold">Compare</span>.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2 text-right">{productA.name}</th>
                  <th className="px-3 py-2 text-right">{productB.name}</th>
                  <th className="px-3 py-2 text-right">Diff (A−B)</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => {
                  const a = mapA.get(m) ?? 0;
                  const b = mapB.get(m) ?? 0;
                  const diff = a - b;
                  return (
                    <tr key={m} className="border-t border-slate-800/70">
                      <td className="px-3 py-2">{formatYM(m)}</td>
                      <td className="px-3 py-2 text-right">{a}</td>
                      <td className="px-3 py-2 text-right">{b}</td>
                      <td className="px-3 py-2 text-right">
                        {diff > 0 ? `+${diff}` : diff}
                      </td>
                    </tr>
                  );
                })}

                {months.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                      No monthly sales records found for these products.
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
