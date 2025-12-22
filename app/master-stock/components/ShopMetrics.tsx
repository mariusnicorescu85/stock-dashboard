"use client";

import React from "react";
import { ProductRecord } from "@/lib/airtable";

type ShopAllocation = {
  shopId: string;
  allocatedStock: number;
};

type ProductAllocation = {
  productId: string;
  masterStock: number;
  shopAllocations: ShopAllocation[];
};

type Shop = {
  id: string;
  name: string;
  dailyDemand: number;
};

type Props = {
  products: ProductRecord[];
  allocations: Map<string, ProductAllocation>;
  activeShops: Shop[];
};

export default function ShopMetrics({ products, allocations, activeShops }: Props) {
  const individuals = products.filter((p) => p.productType === "Individual");

  const shopMetrics = activeShops.map((shop) => {
    let totalAllocated = 0;
    let totalDays = 0;
    let count = 0;
    let fastestConsuming = 0;

    individuals.forEach((product) => {
      const allocation = allocations.get(product.id);
      if (!allocation) return;

      const shopAlloc = allocation.shopAllocations.find((a) => a.shopId === shop.id);
      const allocated = shopAlloc?.allocatedStock ?? 0;
      totalAllocated += allocated;

      if (allocated > 0 && shop.dailyDemand > 0) {
        const days = allocated / shop.dailyDemand;
        totalDays += days;
        count++;
        if (days < fastestConsuming || fastestConsuming === 0) {
          fastestConsuming = days;
        }
      }
    });

    const avgDays = count > 0 ? totalDays / count : null;
    const totalDailyDemand = shop.dailyDemand * individuals.length;

    return {
      shop,
      totalAllocated,
      avgDays,
      fastestConsuming: fastestConsuming > 0 ? fastestConsuming : null,
      totalDailyDemand,
    };
  });

  // Sort by total allocated (descending)
  shopMetrics.sort((a, b) => b.totalAllocated - a.totalAllocated);

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <h2 className="text-lg font-semibold text-slate-200 mb-4">Shop Performance</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shopMetrics.map(({ shop, totalAllocated, avgDays, fastestConsuming, totalDailyDemand }) => (
          <div
            key={shop.id}
            className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200">{shop.name}</h3>
              <span className="text-xs text-slate-500 bg-slate-800/60 px-2 py-1 rounded-full">
                {shop.dailyDemand}/day
              </span>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-slate-400 mb-1">Total Allocated</p>
                <p className="text-xl font-bold text-emerald-300 tabular-nums">
                  {totalAllocated}
                </p>
              </div>
              {avgDays != null && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Avg Days Coverage</p>
                  <p className="text-lg font-semibold text-slate-200 tabular-nums">
                    {Math.round(avgDays)}d
                  </p>
                </div>
              )}
              {fastestConsuming != null && fastestConsuming <= 7 && (
                <div className="pt-2 border-t border-slate-800/60">
                  <p className="text-xs text-red-400 mb-1">⚠️ Fastest consuming</p>
                  <p className="text-sm font-semibold text-red-300 tabular-nums">
                    {Math.round(fastestConsuming)}d
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

