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
      className="min-w-[12rem] cursor-pointer rounded-lg border border-slate-700/85 bg-slate-900/50 px-4 py-2.5 text-[14px] font-medium text-slate-100 outline-none ring-slate-800 transition hover:border-slate-600 hover:bg-slate-900 focus:border-teal-500/55 focus:ring-2 focus:ring-teal-400/25"
    >
      <option value="all">All shops</option>
      <option value="pyt">PYT Hairstyle</option>
      <option value="opatra">Opatra</option>
    </select>
  );
}
