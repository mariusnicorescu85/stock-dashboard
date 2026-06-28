"use client";

import { useRouter } from "next/navigation";
import type { ShopFilter } from "@/lib/shopFilter";

type Props = {
  shop: ShopFilter;
};

export default function MonitorShopSelect({ shop }: Props) {
  const router = useRouter();

  function onChange(next: ShopFilter) {
    const p = new URLSearchParams();
    if (next !== "all") p.set("shop", next);
    router.push(`/monitor${p.toString() ? `?${p}` : ""}`);
  }

  return (
    <select
      value={shop}
      onChange={(e) => onChange(e.target.value as ShopFilter)}
      aria-label="Shop"
      className="min-w-[12rem] cursor-pointer rounded-lg border border-zinc-300/85 bg-zinc-50 px-4 py-2.5 text-[14px] font-medium text-zinc-900 outline-none ring-zinc-200 transition hover:border-zinc-300 hover:bg-zinc-50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
    >
      <option value="all">All shops</option>
      <option value="pyt">PYT Hairstyle</option>
      <option value="opatra">Opatra</option>
    </select>
  );
}
