import React from "react";
import Link from "next/link";
import { fetchProducts } from "@/lib/airtable";
import MasterStockClient from "./MasterStockClient";

export const dynamic = "force-dynamic";

// Placeholder shops - replace with real data later
const PLACEHOLDER_SHOPS = [
  { id: "shop1", name: "Shop A", dailyDemand: 20 },
  { id: "shop2", name: "Shop B", dailyDemand: 15 },
  { id: "shop3", name: "Shop C", dailyDemand: 10 },
  { id: "shop4", name: "Shop D", dailyDemand: 12 },
  { id: "shop5", name: "Shop E", dailyDemand: 8 },
];

type ShopAllocation = {
  shopId: string;
  allocatedStock: number;
};

type ProductAllocation = {
  productId: string;
  masterStock: number;
  shopAllocations: ShopAllocation[];
};

export default async function MasterStockPage() {
  const products = await fetchProducts();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Master Stock & Shop Allocation</h1>
            <p className="text-sm text-slate-400">
              Allocate master stock to shops and track runway for each shop and master stock.
            </p>
          </div>
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
            ← Back to dashboard
          </Link>
        </div>

        <MasterStockClient products={products} />
      </div>
    </main>
  );
}

