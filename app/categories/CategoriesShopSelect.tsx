"use client";

import { useRouter } from "next/navigation";
import type { ShopFilter } from "@/lib/shopFilter";

export type CategoriesShopFilter = ShopFilter;

type Props = {
  year: number;
  shop: ShopFilter;
};

export default function CategoriesShopSelect({ year, shop }: Props) {
  const router = useRouter();

  function onChange(next: ShopFilter) {
    const p = new URLSearchParams();
    p.set("year", String(year));
    if (next !== "all") p.set("shop", next);
    router.push(`/categories?${p.toString()}`);
  }

  return (
    <label className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-slate-400 whitespace-nowrap">Shop:</span>
      <select
        value={shop}
        onChange={(e) => onChange(e.target.value as ShopFilter)}
        className="rounded-lg border border-slate-600 bg-slate-950/90 px-2.5 py-1.5 text-slate-100 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
      >
        <option value="all">All</option>
        <option value="pyt">PYT Hairstyle</option>
        <option value="opatra">Opatra</option>
      </select>
    </label>
  );
}
