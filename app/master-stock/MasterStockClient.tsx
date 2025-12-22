"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ProductRecord } from "@/lib/airtable";
import { fmtGB } from "@/lib/StockMath";
import AllocationSummary from "./components/AllocationSummary";
import StockAlerts from "./components/StockAlerts";
import QuickActions from "./components/QuickActions";
import ShopMetrics from "./components/ShopMetrics";

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
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

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
    // Try to load from localStorage first
    const saved = localStorage.getItem(`stock-allocations-${activeCategory}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const loaded = new Map<string, ProductAllocation>();
        products.forEach((p) => {
          const savedAlloc = parsed[p.id];
          if (savedAlloc) {
            // Update master stock from current data but keep allocations
            loaded.set(p.id, {
              ...savedAlloc,
              masterStock: p.currentStock + p.incomingStockTotal,
            });
          } else {
            // New product, initialize
            loaded.set(p.id, {
              productId: p.id,
              masterStock: p.currentStock + p.incomingStockTotal,
              shopAllocations: [...OPATRA_SHOPS, ...PYT_SHOPS].map((shop) => ({
                shopId: shop.id,
                allocatedStock: 0,
              })),
            });
          }
        });
        setAllocations(loaded);
        return;
      } catch (e) {
        console.error("Failed to load saved allocations", e);
      }
    }

    // Initialize fresh
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
  }, [products, activeCategory]);

  // Save allocations to localStorage whenever they change
  useEffect(() => {
    if (allocations.size > 0) {
      const toSave: Record<string, ProductAllocation> = {};
      allocations.forEach((alloc, id) => {
        toSave[id] = alloc;
      });
      localStorage.setItem(`stock-allocations-${activeCategory}`, JSON.stringify(toSave));
    }
  }, [allocations, activeCategory]);

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

  const handleAllocationsChange = (newAllocations: Map<string, ProductAllocation>) => {
    setAllocations(newAllocations);
  };

  // Bulk allocate to selected products
  const bulkAllocate = (shopId: string, value: number) => {
    if (selectedProducts.size === 0) return;

    const newAllocations = new Map(allocations);
    selectedProducts.forEach((productId) => {
      const allocation = newAllocations.get(productId);
      if (!allocation) return;

      const updated = { ...allocation };
      const shopAlloc = updated.shopAllocations.find((a) => a.shopId === shopId);
      if (shopAlloc) {
        const currentTotal = updated.shopAllocations.reduce(
          (sum, a) => (a.shopId === shopId ? sum : sum + a.allocatedStock),
          0
        );
        const maxAllowed = Math.max(0, updated.masterStock - currentTotal);
        shopAlloc.allocatedStock = Math.min(value, maxAllowed);
      }
      newAllocations.set(productId, updated);
    });
    setAllocations(newAllocations);
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedProducts(new Set(individuals.map((p) => p.id)));
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ["Product", "Master Stock", ...activeShops.map((s) => s.name), "Total Allocated", "Remaining", "Master Runway (days)"];
    const rows = individuals.map((product) => {
      const allocation = allocations.get(product.id);
      if (!allocation) return [];

      const totalAllocated = allocation.shopAllocations.reduce(
        (sum, a) => (activeShops.some((s) => s.id === a.shopId) ? sum + a.allocatedStock : sum),
        0
      );
      const remaining = allocation.masterStock - totalAllocated;

      const totalDailyDemand = activeShops.reduce((sum, shop) => {
        const shopAlloc = allocation.shopAllocations.find((a) => a.shopId === shop.id);
        return sum + (shopAlloc && shopAlloc.allocatedStock > 0 ? shop.dailyDemand : 0);
      }, 0);

      const masterRunway = totalDailyDemand > 0 ? remaining / totalDailyDemand : null;

      return [
        product.name,
        allocation.masterStock,
        ...activeShops.map((shop) => {
          const shopAlloc = allocation.shopAllocations.find((a) => a.shopId === shop.id);
          return shopAlloc?.allocatedStock ?? 0;
        }),
        totalAllocated,
        remaining,
        masterRunway != null ? Math.round(masterRunway) : "",
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-allocation-${activeCategory}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      {/* Stock Alerts */}
      <StockAlerts
        products={filteredProducts}
        allocations={allocations}
        activeShops={activeShops}
      />

      {/* Quick Actions */}
      <QuickActions
        products={filteredProducts}
        allocations={allocations}
        activeShops={activeShops}
        onAllocationsChange={handleAllocationsChange}
      />

      {/* Allocation Summary */}
      <AllocationSummary
        products={filteredProducts}
        allocations={allocations}
        activeShops={activeShops}
      />

      {/* Shop Metrics */}
      <ShopMetrics
        products={filteredProducts}
        allocations={allocations}
        activeShops={activeShops}
      />

      {/* Category selector */}
      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-200">Shop Category</h2>
            <p className="text-xs text-slate-400 mt-1">
              Select a category to view and allocate stock to shops
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveCategory("opatra")}
              className={`rounded-xl border px-5 py-2.5 text-sm font-medium transition ${
                activeCategory === "opatra"
                  ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100 shadow-[0_8px_24px_rgba(52,211,153,0.25)]"
                  : "border-slate-700/80 bg-slate-900/70 text-slate-200 hover:border-emerald-300/40 hover:text-emerald-100"
              }`}
            >
              Opatra Shops
            </button>
            <button
              onClick={() => setActiveCategory("pyt")}
              className={`rounded-xl border px-5 py-2.5 text-sm font-medium transition ${
                activeCategory === "pyt"
                  ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100 shadow-[0_8px_24px_rgba(52,211,153,0.25)]"
                  : "border-slate-700/80 bg-slate-900/70 text-slate-200 hover:border-emerald-300/40 hover:text-emerald-100"
              }`}
            >
              PYT Shops
            </button>
          </div>
        </div>

        {/* Active shops info - Card layout */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              {activeCategory === "opatra" ? "Opatra" : "PYT"} Shops
            </h3>
            <span className="text-xs text-slate-500 bg-slate-800/60 px-2 py-1 rounded-full">
              {activeShops.length} shop{activeShops.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeShops.map((shop) => (
              <div
                key={shop.id}
                className="rounded-xl border border-slate-700/80 bg-gradient-to-br from-slate-950/90 to-slate-900/70 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.3)] hover:border-emerald-400/40 transition-all hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-100">{shop.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Placeholder shop</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-400/20">
                    <span className="text-lg">🏪</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-800/60">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-emerald-300 tabular-nums">
                      {shop.dailyDemand}
                    </span>
                    <span className="text-xs text-slate-400">units/day</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800/60">
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400/60"></span>
              Showing only {activeCategory === "opatra" ? "Opatra" : "PYT"} products. These are placeholder shops. Replace with real shop data when available.
            </p>
          </div>
        </div>
      </section>

      {/* Products table */}
      <section className="rounded-2xl border border-slate-800/80 bg-slate-900/70 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-200">Product Allocations</h2>
            {selectedProducts.size > 0 && (
              <span className="text-xs text-slate-400 bg-slate-800/60 px-2 py-1 rounded-full">
                {selectedProducts.size} selected
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {selectedProducts.size > 0 && (
              <>
                <button
                  onClick={clearSelection}
                  className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-900/80 transition-colors"
                >
                  Clear Selection
                </button>
                {activeShops.map((shop) => (
                  <button
                    key={shop.id}
                    onClick={() => {
                      const avg = Math.floor(
                        Array.from(selectedProducts).reduce((sum, id) => {
                          const alloc = allocations.get(id);
                          return sum + (alloc?.masterStock ?? 0) / activeShops.length;
                        }, 0) / selectedProducts.size
                      );
                      bulkAllocate(shop.id, avg);
                    }}
                    className="rounded-xl border border-emerald-700/80 bg-emerald-950/60 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-900/80 transition-colors"
                    title={`Allocate to ${shop.name}`}
                  >
                    {shop.name.slice(0, 8)}
                  </button>
                ))}
              </>
            )}
            <button
              onClick={selectAll}
              className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-900/80 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={exportToCSV}
              className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900/80 hover:border-emerald-400/40 transition-colors"
            >
              📥 Export CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-950/90 text-xs uppercase text-slate-400 sticky top-0 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <input
                    type="checkbox"
                    checked={selectedProducts.size === individuals.length && individuals.length > 0}
                    onChange={(e) => (e.target.checked ? selectAll() : clearSelection())}
                    className="rounded border-slate-700 bg-slate-950"
                  />
                </th>
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

                  const isLowStock = remaining < allocation.masterStock * 0.2;
                  const isCritical = masterRunway.daysUntilRunOut != null && masterRunway.daysUntilRunOut <= 14;

                  const isSelected = selectedProducts.has(product.id);

                  return (
                    <tr
                      key={product.id}
                      className={`border-t border-slate-800/70 transition-colors ${
                        isSelected
                          ? "bg-emerald-500/10 hover:bg-emerald-500/15"
                          : isCritical
                          ? "bg-red-500/5 hover:bg-red-500/10"
                          : isLowStock
                          ? "bg-amber-500/5 hover:bg-amber-500/10"
                          : "hover:bg-slate-900/50"
                      }`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleProductSelection(product.id)}
                          className="rounded border-slate-700 bg-slate-950"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/product/${product.id}`}
                          className="group flex items-center gap-2 text-slate-100 hover:text-emerald-300 font-medium transition-colors"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/80 text-xs font-semibold text-slate-300 group-hover:bg-emerald-500/20 group-hover:text-emerald-300 transition-colors">
                            {(product.brand ?? "•").slice(0, 1)}
                          </span>
                          <span className="hover:underline">{product.name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col items-end">
                          <span className="text-right tabular-nums text-slate-100 font-semibold text-lg">
                            {allocation.masterStock}
                          </span>
                          <span className="text-[10px] text-slate-500">master stock</span>
                        </div>
                      </td>
                      {activeShops.map((shop) => {
                        const shopAlloc = allocation.shopAllocations.find(
                          (a) => a.shopId === shop.id
                        );
                        const allocated = shopAlloc?.allocatedStock ?? 0;
                        const shopRunway = calculateShopRunway(shop.id, allocated);
                        const shopIsLow = shopRunway.daysUntilRunOut != null && shopRunway.daysUntilRunOut <= 7;

                        return (
                          <td key={shop.id} className="px-3 py-4">
                            <div className="flex flex-col items-end gap-2">
                              <div className="relative">
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
                                  className={`w-24 rounded-lg border px-3 py-2 text-sm text-slate-100 text-right tabular-nums font-medium transition-all focus:outline-none focus:ring-2 ${
                                    allocated > 0
                                      ? "border-emerald-400/40 bg-emerald-500/10 focus:border-emerald-400 focus:ring-emerald-500/30"
                                      : "border-slate-700 bg-slate-950/70 focus:border-slate-600 focus:ring-slate-600/30"
                                  }`}
                                />
                                {allocated > 0 && (
                                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-slate-950"></span>
                                )}
                              </div>
                              {shopRunway.daysUntilRunOut != null && (
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`text-xs font-medium tabular-nums px-2 py-0.5 rounded-full ${
                                      shopIsLow
                                        ? "bg-red-500/15 text-red-300 border border-red-500/30"
                                        : "bg-slate-800/60 text-slate-300 border border-slate-700/60"
                                    }`}
                                  >
                                    {Math.round(shopRunway.daysUntilRunOut)}d
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-4 py-4">
                        <div className="flex flex-col items-end">
                          <span className="text-right tabular-nums text-slate-200 font-semibold">
                            {totalAllocated}
                          </span>
                          <span className="text-[10px] text-slate-500">allocated</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col items-end">
                          <span
                            className={`text-right tabular-nums font-semibold ${
                              isLowStock ? "text-amber-300" : "text-slate-200"
                            }`}
                          >
                            {remaining}
                          </span>
                          <span className="text-[10px] text-slate-500">remaining</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {masterRunway.daysUntilRunOut != null ? (
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`tabular-nums font-semibold px-2.5 py-1 rounded-lg ${
                                isCritical
                                  ? "bg-red-500/15 text-red-300 border border-red-500/30"
                                  : masterRunway.daysUntilRunOut <= 30
                                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                  : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              }`}
                            >
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

