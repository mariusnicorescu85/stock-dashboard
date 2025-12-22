"use client";

import React from "react";
import { ProductRecord } from "@/lib/airtable";
import { fmtGB } from "@/lib/StockMath";

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

export default function AllocationSummary({ products, allocations, activeShops }: Props) {
  const individuals = products.filter((p) => p.productType === "Individual");

  // Calculate totals
  const totalMasterStock = individuals.reduce((sum, p) => {
    const alloc = allocations.get(p.id);
    return sum + (alloc?.masterStock ?? 0);
  }, 0);

  const totalAllocated = individuals.reduce((sum, p) => {
    const alloc = allocations.get(p.id);
    if (!alloc) return sum;
    return (
      sum +
      alloc.shopAllocations.reduce(
        (s, a) => (activeShops.some((shop) => shop.id === a.shopId) ? s + a.allocatedStock : s),
        0
      )
    );
  }, 0);

  const totalRemaining = totalMasterStock - totalAllocated;

  // Calculate per-shop totals
  const shopTotals = activeShops.map((shop) => {
    const total = individuals.reduce((sum, p) => {
      const alloc = allocations.get(p.id);
      if (!alloc) return sum;
      const shopAlloc = alloc.shopAllocations.find((a) => a.shopId === shop.id);
      return sum + (shopAlloc?.allocatedStock ?? 0);
    }, 0);

    const totalDailyDemand = shop.dailyDemand * individuals.length; // Simplified
    const avgDays = totalDailyDemand > 0 ? total / totalDailyDemand : null;

    return {
      shop,
      total,
      avgDays,
    };
  });

  // Calculate master stock runway
  const totalDailyDemand = activeShops.reduce((sum, shop) => {
    const shopTotal = individuals.reduce((s, p) => {
      const alloc = allocations.get(p.id);
      if (!alloc) return s;
      const shopAlloc = alloc.shopAllocations.find((a) => a.shopId === shop.id);
      return s + (shopAlloc && shopAlloc.allocatedStock > 0 ? shop.dailyDemand : 0);
    }, 0);
    return sum + shopTotal;
  }, 0);

  const masterRunway = totalDailyDemand > 0 ? totalRemaining / totalDailyDemand : null;
  const masterRunOutDate = masterRunway
    ? (() => {
        const date = new Date();
        date.setDate(date.getDate() + Math.round(masterRunway));
        return date;
      })()
    : null;

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <h2 className="text-lg font-semibold text-slate-200 mb-4">Allocation Summary</h2>

      {/* Overall totals */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Master Stock</p>
          <p className="text-2xl font-bold text-slate-100 tabular-nums">{totalMasterStock}</p>
        </div>
        <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Total Allocated</p>
          <p className="text-2xl font-bold text-emerald-300 tabular-nums">{totalAllocated}</p>
        </div>
        <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Remaining</p>
          <p className="text-2xl font-bold text-amber-300 tabular-nums">{totalRemaining}</p>
        </div>
      </div>

      {/* Master runway */}
      {masterRunway != null && (
        <div className="mb-6 p-4 rounded-xl border border-slate-700/80 bg-slate-950/60">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Master Stock Runway</p>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-slate-100 tabular-nums">
              {Math.round(masterRunway)}
            </span>
            <span className="text-sm text-slate-400">days</span>
            {masterRunOutDate && (
              <span className="ml-auto text-xs text-slate-500">
                Until {fmtGB(masterRunOutDate)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Per-shop totals */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Allocated by Shop</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shopTotals.map(({ shop, total, avgDays }) => (
            <div
              key={shop.id}
              className="rounded-lg border border-slate-700/80 bg-slate-950/60 p-3"
            >
              <p className="text-xs text-slate-400 mb-1">{shop.name}</p>
              <p className="text-lg font-semibold text-emerald-300 tabular-nums">{total}</p>
              {avgDays != null && (
                <p className="text-xs text-slate-500 mt-1">~{Math.round(avgDays)} days avg</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

