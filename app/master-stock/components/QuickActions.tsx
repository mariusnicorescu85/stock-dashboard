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
  onAllocationsChange: (newAllocations: Map<string, ProductAllocation>) => void;
};

export default function QuickActions({
  products,
  allocations,
  activeShops,
  onAllocationsChange,
}: Props) {
  const individuals = products.filter((p) => p.productType === "Individual");

  const distributeEvenly = () => {
    const newAllocations = new Map(allocations);
    individuals.forEach((product) => {
      const allocation = newAllocations.get(product.id);
      if (!allocation) return;

      const perShop = Math.floor(allocation.masterStock / activeShops.length);
      const updated = { ...allocation };
      updated.shopAllocations = updated.shopAllocations.map((a) => {
        if (activeShops.some((s) => s.id === a.shopId)) {
          return { ...a, allocatedStock: perShop };
        }
        return a;
      });
      newAllocations.set(product.id, updated);
    });
    onAllocationsChange(newAllocations);
  };

  const distributeByDemand = () => {
    const newAllocations = new Map(allocations);
    const totalDemand = activeShops.reduce((sum, s) => sum + s.dailyDemand, 0);

    individuals.forEach((product) => {
      const allocation = newAllocations.get(product.id);
      if (!allocation || totalDemand === 0) return;

      const updated = { ...allocation };
      updated.shopAllocations = updated.shopAllocations.map((a) => {
        const shop = activeShops.find((s) => s.id === a.shopId);
        if (shop) {
          const share = (shop.dailyDemand / totalDemand) * allocation.masterStock;
          return { ...a, allocatedStock: Math.floor(share) };
        }
        return a;
      });
      newAllocations.set(product.id, updated);
    });
    onAllocationsChange(newAllocations);
  };

  const allocateToTargetDays = (targetDays: number = 30) => {
    const newAllocations = new Map(allocations);

    individuals.forEach((product) => {
      const allocation = newAllocations.get(product.id);
      if (!allocation) return;

      const updated = { ...allocation };
      let totalNeeded = 0;

      // Calculate what each shop needs for target days
      const needs = activeShops.map((shop) => {
        const needed = shop.dailyDemand * targetDays;
        totalNeeded += needed;
        return { shopId: shop.id, needed };
      });

      // If we have enough stock, allocate proportionally
      if (totalNeeded <= allocation.masterStock) {
        updated.shopAllocations = updated.shopAllocations.map((a) => {
          const need = needs.find((n) => n.shopId === a.shopId);
          if (need) {
            return { ...a, allocatedStock: need.needed };
          }
          return a;
        });
      } else {
        // Distribute proportionally based on needs
        const ratio = allocation.masterStock / totalNeeded;
        updated.shopAllocations = updated.shopAllocations.map((a) => {
          const need = needs.find((n) => n.shopId === a.shopId);
          if (need) {
            return { ...a, allocatedStock: Math.floor(need.needed * ratio) };
          }
          return a;
        });
      }

      newAllocations.set(product.id, updated);
    });
    onAllocationsChange(newAllocations);
  };

  const clearAll = () => {
    const newAllocations = new Map(allocations);
    individuals.forEach((product) => {
      const allocation = newAllocations.get(product.id);
      if (!allocation) return;

      const updated = { ...allocation };
      updated.shopAllocations = updated.shopAllocations.map((a) => {
        if (activeShops.some((s) => s.id === a.shopId)) {
          return { ...a, allocatedStock: 0 };
        }
        return a;
      });
      newAllocations.set(product.id, updated);
    });
    onAllocationsChange(newAllocations);
  };

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <h2 className="text-lg font-semibold text-slate-200 mb-4">Quick Actions</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          onClick={distributeEvenly}
          className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-900/80 hover:border-emerald-400/40 transition-colors"
        >
          <div className="text-lg mb-1">⚖️</div>
          <div>Distribute Evenly</div>
        </button>
        <button
          onClick={distributeByDemand}
          className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-900/80 hover:border-emerald-400/40 transition-colors"
        >
          <div className="text-lg mb-1">📊</div>
          <div>By Demand</div>
        </button>
        <button
          onClick={() => allocateToTargetDays(30)}
          className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-900/80 hover:border-emerald-400/40 transition-colors"
        >
          <div className="text-lg mb-1">🎯</div>
          <div>30 Days Coverage</div>
        </button>
        <button
          onClick={clearAll}
          className="rounded-xl border border-red-700/80 bg-red-950/60 px-4 py-3 text-sm font-medium text-red-200 hover:bg-red-900/80 hover:border-red-400/40 transition-colors"
        >
          <div className="text-lg mb-1">🗑️</div>
          <div>Clear All</div>
        </button>
      </div>
    </section>
  );
}

