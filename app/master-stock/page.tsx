import React from "react";
import Link from "next/link";
import { fetchProducts } from "@/lib/airtable";
import MasterStockClient from "./MasterStockClient";

export const dynamic = "force-dynamic";

export default async function MasterStockPage() {
  const products = await fetchProducts();

  return (
    <main className="min-h-screen text-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Master Stock & Shop Allocation</h1>
            <p className="text-sm text-zinc-500">
              Allocate master stock to shops and track runway for each shop and master stock.
            </p>
          </div>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← Back to dashboard
          </Link>
        </div>

        <MasterStockClient products={products} />
      </div>
    </main>
  );
}

