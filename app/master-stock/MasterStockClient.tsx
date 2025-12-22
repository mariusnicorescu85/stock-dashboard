"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ProductRecord } from "@/lib/airtable";
import { fmtGB } from "@/lib/StockMath";

// Placeholder shops - replace with real data later
const OPATRA_SHOPS = [
  { id: "opatra1", name: "Opatra Shop 1", dailyDemand: 20 },
  { id: "opatra2", name: "Opatra Shop 2", dailyDemand: 15 },
  { id: "opatra3", name: "Opatra Shop 3", dailyDemand: 10 },
];

const PYT_SHOPS = [
  { id: "pyt1", name: "PYT Shop 1", dailyDemand: 12 },
  { id: "pyt2", name: "PYT Shop 2", dailyDemand: 8 },
];

type ShopCategory = "opatra" | "pyt";

type ShopAllocation = {
  shopId: string;
  allocatedStock: number;
};

type ProductAllocation = {
  productId: string;
  masterStock: number;
  shopAllocations: ShopAllocation[];
};

export default function MasterStockClient({ products }: { products: ProductRecord[] }) {
  const [allocations, setAllocations] = useState<Map<string, ProductAllocation>>(new Map());
  const [activeCategory, setActiveCategory] = useState<ShopCategory>("opatra");

  const activeShops = activeCategory === "opatra" ? OPATRA_SHOPS : PYT_SHOPS;
  
  // Filter products by brand based on active category
  const filteredProducts = products.filter((p) => {
    if (activeCategory === "opatra") {
      return (p.brand ?? "").toLowerCase().includes("opatra");
    } else {
      return (p.brand ?? "").toLowerCase().includes("pyt");
    }
  });

  // Initialize allocations from products (for all products, but we'll filter display)
  useEffect(() => {
    const initial = new Map<string, ProductAllocation>();
    products.forEach((p) => {
      if (!initial.has(p.id)) {
        initial.set(p.id, {
          productId: p.id,
          masterStock: p.currentStock + p.incomingStockTotal,
          shopAllocations: [...OPATRA_SHOPS, ...PYT_SHOPS].map((shop) => ({
            shopId: shop.id,
            allocatedStock: 0,
          })),
        });
      }
    });
    setAllocations(initial);
  }, [products]);

  const updateAllocation = (
    productId: string,
    shopId: string,
    value: number
  ) => {
    setAllocations((prev) => {
      const newMap = new Map(prev);
      const product = newMap.get(productId);
      if (!product) return prev;

      const updated = { ...product };
      const shopAlloc = updated.shopAllocations.find((a) => a.shopId === shopId);
      if (shopAlloc) {
        const newValue = Math.max(0, value);
        // Calculate current total allocated (excluding this shop)
        const currentTotal = updated.shopAllocations.reduce(
          (sum, a) => (a.shopId === shopId ? sum : sum + a.allocatedStock),
          0
        );
        // Ensure total doesn't exceed master stock
        const maxAllowed = Math.max(0, updated.masterStock - currentTotal);
        shopAlloc.allocatedStock = Math.min(newValue, maxAllowed);
      }

      newMap.set(productId, updated);
      return newMap;
    });
  };

  const getProductAllocation = (productId: string): ProductAllocation | null => {
    return allocations.get(productId) || null;
  };

  const getShop = (shopId: string) => {
    return [...OPATRA_SHOPS, ...PYT_SHOPS].find((s) => s.id === shopId);
  };

  const calculateMasterStockRunway = (product: ProductRecord, allocation: ProductAllocation) => {
    const totalAllocated = allocation.shopAllocations.reduce(
      (sum, a) => sum + a.allocatedStock,
      0
    );
    const remainingMasterStock = allocation.masterStock - totalAllocated;

    const totalDailyDemand = [...OPATRA_SHOPS, ...PYT_SHOPS].reduce(
      (sum, shop) => {
        const alloc = allocation.shopAllocations.find((a) => a.shopId === shop.id);
        if (alloc && alloc.allocatedStock > 0) {
          return sum + shop.dailyDemand;
        }
        return sum;
      },
      0
    );

    if (totalDailyDemand <= 0) {
      return { daysUntilRunOut: null, runOutDate: null };
    }

    const daysUntilRunOut = remainingMasterStock / totalDailyDemand;
    const runOut = new Date();
    runOut.setDate(runOut.getDate() + Math.round(daysUntilRunOut));

    return {
      daysUntilRunOut,
      runOutDate: runOut,
    };
  };

  const calculateShopRunway = (
    shopId: string,
    allocatedStock: number
  ): { daysUntilRunOut: number | null; runOutDate: Date | null } => {
    const shop = getShop(shopId);
    if (!shop || shop.dailyDemand <= 0 || allocatedStock <= 0) {
      return { daysUntilRunOut: null, runOutDate: null };
    }

    const daysUntilRunOut = allocatedStock / shop.dailyDemand;
    const runOut = new Date();
    runOut.setDate(runOut.getDate() + Math.round(daysUntilRunOut));

    return {
      daysUntilRunOut,
      runOutDate: runOut,
    };
  };

  const individuals = filteredProducts.filter((p) => p.productType === "Individual");

  return (
    <>
      {/* Category selector */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300">Shop Category</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveCategory("opatra")}
              className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                activeCategory === "opatra"
                  ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100 shadow-[0_8px_24px_rgba(52,211,153,0.25)]"
                  : "border-slate-700/80 bg-slate-900/70 text-slate-200 hover:border-emerald-300/40 hover:text-emerald-100"
              }`}
            >
              Opatra Shops
            </button>
            <button
              onClick={() => setActiveCategory("pyt")}
              className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                activeCategory === "pyt"
                  ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100 shadow-[0_8px_24px_rgba(52,211,153,0.25)]"
                  : "border-slate-700/80 bg-slate-900/70 text-slate-200 hover:border-emerald-300/40 hover:text-emerald-100"
              }`}
            >
              PYT Shops
            </button>
          </div>
        </div>

        {/* Active shops info */}
        <div>
          <h3 className="text-xs text-slate-400 mb-2 uppercase tracking-wide">
            {activeCategory === "opatra" ? "Opatra" : "PYT"} Shops (Placeholders)
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {activeShops.map((shop) => (
              <div
                key={shop.id}
                className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-3"
              >
                <p className="text-xs text-slate-400 uppercase tracking-wide">{shop.name}</p>
                <p className="mt-1 text-lg font-semibold text-emerald-300">
                  {shop.dailyDemand}/day
                </p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Showing only {activeCategory === "opatra" ? "Opatra" : "PYT"} products. These are placeholder shops. Replace with real shop data when available.
        </p>
      </section>

      {/* Products table */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-right">Master Stock</th>
                {activeShops.map((shop) => (
                  <th key={shop.id} className="px-3 py-3 text-right min-w-[120px]">
                    <div className="flex flex-col">
                      <span>{shop.name}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        ({shop.dailyDemand}/day)
                      </span>
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Total Allocated</th>
                <th className="px-4 py-3 text-right">Remaining</th>
                <th className="px-4 py-3 text-right">Master Runway</th>
              </tr>
            </thead>
            <tbody>
              {individuals.map((product) => {
                const allocation = getProductAllocation(product.id);
                if (!allocation) return null;

                const totalAllocated = allocation.shopAllocations.reduce(
                  (sum, a) => sum + a.allocatedStock,
                  0
                );
                const remaining = allocation.masterStock - totalAllocated;
                const masterRunway = calculateMasterStockRunway(product, allocation);

                return (
                  <tr
                    key={product.id}
                    className="border-t border-slate-800/70 hover:bg-slate-900/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/product/${product.id}`}
                        className="text-slate-100 hover:underline font-medium"
                      >
                        {product.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-100">
                      {allocation.masterStock}
                    </td>
                    {activeShops.map((shop) => {
                      const shopAlloc = allocation.shopAllocations.find(
                        (a) => a.shopId === shop.id
                      );
                      const allocated = shopAlloc?.allocatedStock ?? 0;
                      const shopRunway = calculateShopRunway(shop.id, allocated);

                      return (
                        <td key={shop.id} className="px-3 py-3">
                          <div className="flex flex-col items-end gap-1">
                            <input
                              type="number"
                              min="0"
                              max={allocation.masterStock}
                              value={allocated}
                              onChange={(e) =>
                                updateAllocation(
                                  product.id,
                                  shop.id,
                                  Number(e.target.value) || 0
                                )
                              }
                              className="w-20 rounded border border-slate-700 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 text-right tabular-nums focus:border-emerald-400 focus:outline-none"
                            />
                            {shopRunway.daysUntilRunOut != null && (
                              <span className="text-[10px] text-slate-400">
                                {Math.round(shopRunway.daysUntilRunOut)}d
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                      {totalAllocated}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                      {remaining}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {masterRunway.daysUntilRunOut != null ? (
                        <div className="flex flex-col items-end">
                          <span className="text-slate-100 tabular-nums">
                            {Math.round(masterRunway.daysUntilRunOut)}d
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {fmtGB(masterRunway.runOutDate)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

