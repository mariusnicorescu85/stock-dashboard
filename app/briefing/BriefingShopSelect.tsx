"use client";

import { useRouter } from "next/navigation";
import type { ShopFilter } from "@/lib/shopFilter";

type Props = {
  shop: ShopFilter;
};

export default function BriefingShopSelect({ shop }: Props) {
  const router = useRouter();

  function onChange(next: ShopFilter) {
    const p = new URLSearchParams();
    if (next !== "all") p.set("shop", next);
    router.push(`/briefing${p.toString() ? `?${p}` : ""}`);
  }

  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-400 whitespace-nowrap">Shop:</span>
      <select
        value={shop}
        onChange={(e) => onChange(e.target.value as ShopFilter)}
        className="rounded-xl border border-slate-600 bg-slate-950/90 px-3 py-2 text-slate-100 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
      >
        <option value="all">All shops</option>
        <option value="pyt">PYT Hairstyle</option>
        <option value="opatra">Opatra</option>
      </select>
    </label>
  );
}
