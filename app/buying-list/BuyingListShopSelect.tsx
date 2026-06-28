"use client";

import { useRouter } from "next/navigation";
import type { ShopFilter } from "@/lib/shopFilter";

type Props = {
  shop: ShopFilter;
};

export default function BuyingListShopSelect({ shop }: Props) {
  const router = useRouter();

  function onChange(next: ShopFilter) {
    const p = new URLSearchParams();
    if (next !== "all") p.set("shop", next);
    router.push(`/buying-list${p.toString() ? `?${p}` : ""}`);
  }

  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-zinc-500 whitespace-nowrap">Shop:</span>
      <select
        value={shop}
        onChange={(e) => onChange(e.target.value as ShopFilter)}
        className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
      >
        <option value="all">All shops</option>
        <option value="pyt">PYT Hairstyle</option>
        <option value="opatra">Opatra</option>
      </select>
    </label>
  );
}
