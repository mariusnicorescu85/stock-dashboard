"use client";

import { useRouter } from "next/navigation";

type ProductOption = { id: string; name: string; brand?: string };

export default function CompareOneForm({
  products,
  productId,
  monthsAvailable,
  selectedMonths,
}: {
  products: ProductOption[];
  productId: string;
  monthsAvailable: string[];
  selectedMonths: string[];
}) {
  const router = useRouter();

  return (
    <form method="get" className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1 sm:col-span-1">
        <label className="text-xs uppercase tracking-wide text-slate-400">
          Product
        </label>
        <select
          name="p"
          value={productId}
          onChange={(e) => {
            const next = e.target.value;
            // load months immediately, clear months selection
            router.push(next ? `/compare-one?p=${next}` : `/compare-one`);
          }}
          className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm"
        >
          <option value="">— Select —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.brand ?? "—"})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1 sm:col-span-2">
        <label className="text-xs uppercase tracking-wide text-slate-400">
          Months (multi-select)
        </label>
        <select
          name="m"
          multiple
          defaultValue={selectedMonths}
          className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm"
          size={Math.min(12, Math.max(6, monthsAvailable.length || 6))}
          disabled={!productId}
        >
          {monthsAvailable.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button className="inline-flex h-9 items-center rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-900 hover:bg-white">
            Apply
          </button>
        </div>
      </div>
    </form>
  );
}
