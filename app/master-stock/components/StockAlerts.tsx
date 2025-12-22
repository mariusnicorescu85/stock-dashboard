"use client";

import React from "react";
import Link from "next/link";
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

export default function StockAlerts({ products, allocations, activeShops }: Props) {
  const individuals = products.filter((p) => p.productType === "Individual");

  // Calculate alerts
  const masterStockAlerts: Array<{
    product: ProductRecord;
    remaining: number;
    pct: number;
  }> = [];

  const shopAlerts: Array<{
    product: ProductRecord;
    shop: Shop;
    days: number;
  }> = [];

  individuals.forEach((product) => {
    const allocation = allocations.get(product.id);
    if (!allocation) return;

    const totalAllocated = allocation.shopAllocations.reduce(
      (sum, a) => (activeShops.some((s) => s.id === a.shopId) ? sum + a.allocatedStock : sum),
      0
    );
    const remaining = allocation.masterStock - totalAllocated;
    const pct = allocation.masterStock > 0 ? (remaining / allocation.masterStock) * 100 : 0;

    // Master stock alerts
    if (remaining < allocation.masterStock * 0.2) {
      masterStockAlerts.push({ product, remaining, pct });
    }

    // Shop alerts
    activeShops.forEach((shop) => {
      const shopAlloc = allocation.shopAllocations.find((a) => a.shopId === shop.id);
      const allocated = shopAlloc?.allocatedStock ?? 0;
      if (allocated > 0 && shop.dailyDemand > 0) {
        const days = allocated / shop.dailyDemand;
        if (days <= 7) {
          shopAlerts.push({ product, shop, days });
        }
      }
    });
  });

  const hasAlerts = masterStockAlerts.length > 0 || shopAlerts.length > 0;

  if (!hasAlerts) {
    return (
      <section className="rounded-2xl border border-emerald-800/40 bg-emerald-500/10 p-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <h2 className="text-lg font-semibold text-emerald-200">All Clear</h2>
            <p className="text-sm text-emerald-300/80">No stock alerts at this time.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <h2 className="text-lg font-semibold text-slate-200 mb-4">Stock Alerts</h2>

      {/* Master stock alerts */}
      {masterStockAlerts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
            <span>⚠️</span> Low Master Stock ({masterStockAlerts.length})
          </h3>
          <div className="space-y-2">
            {masterStockAlerts.slice(0, 5).map(({ product, remaining, pct }) => (
              <Link
                key={product.id}
                href={`/product/${product.id}`}
                className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 hover:bg-amber-500/20 transition-colors"
              >
                <span className="text-sm text-amber-100 font-medium">{product.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-amber-200 tabular-nums">{remaining} left</span>
                  <span className="text-xs text-amber-300/80">{Math.round(pct)}%</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Shop alerts */}
      {shopAlerts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-red-300 mb-3 flex items-center gap-2">
            <span>🔴</span> Shops Running Out Soon ({shopAlerts.length})
          </h3>
          <div className="space-y-2">
            {shopAlerts.slice(0, 5).map(({ product, shop, days }, idx) => (
              <Link
                key={`${product.id}-${shop.id}-${idx}`}
                href={`/product/${product.id}`}
                className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 hover:bg-red-500/20 transition-colors"
              >
                <div>
                  <span className="text-sm text-red-100 font-medium">{product.name}</span>
                  <span className="text-xs text-red-200/80 ml-2">→ {shop.name}</span>
                </div>
                <span className="text-xs text-red-200 tabular-nums font-semibold">
                  {Math.round(days)}d left
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

