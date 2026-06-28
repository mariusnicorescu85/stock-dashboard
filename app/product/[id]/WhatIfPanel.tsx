"use client";

import React, { useState } from "react";
import { computeStockDerived, fmtGB } from "@/lib/StockMath";

type WhatIfPanelProps = {
  currentStock: number;
  incomingStockTotal: number;
  dailyDemand: number;
  leadTimeDays: number | null;
};

export default function WhatIfPanel({
  currentStock,
  incomingStockTotal,
  dailyDemand,
  leadTimeDays,
}: WhatIfPanelProps) {
  const [cur, setCur] = useState<number>(currentStock);
  const [incoming, setIncoming] = useState<number>(incomingStockTotal);
  const [daily, setDaily] = useState<number>(dailyDemand);
  const [lead, setLead] = useState<number>(leadTimeDays ?? 0);

  const derived = computeStockDerived({
    currentStock: cur,
    incomingStock: incoming,
    dailyDemand: daily,
    leadTimeDays: lead,
  });

  const days =
    derived.daysUntilRunOut != null
      ? Math.max(0, Math.round(derived.daysUntilRunOut))
      : null;

  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">
          What if we change demand or lead time?
        </h2>
        <p className="text-xs text-zinc-500">
          Adjust the numbers below to simulate runway and order-by date. This
          does not change Airtable.
        </p>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-xs uppercase tracking-wide text-zinc-500">
              Current stock
            </span>
            <input
              type="number"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900"
              value={cur}
              onChange={(e) => setCur(Number(e.target.value) || 0)}
              min={0}
            />
          </label>

          <label className="space-y-1">
            <span className="block text-xs uppercase tracking-wide text-zinc-500">
              Incoming stock
            </span>
            <input
              type="number"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900"
              value={incoming}
              onChange={(e) => setIncoming(Number(e.target.value) || 0)}
              min={0}
            />
          </label>

          <label className="space-y-1">
            <span className="block text-xs uppercase tracking-wide text-zinc-500">
              Daily demand (units / day)
            </span>
            <input
              type="number"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900"
              value={daily}
              onChange={(e) => setDaily(Number(e.target.value) || 0)}
              min={0}
              step={0.1}
            />
          </label>

          <label className="space-y-1">
            <span className="block text-xs uppercase tracking-wide text-zinc-500">
              Lead time (days)
            </span>
            <input
              type="number"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900"
              value={lead}
              onChange={(e) => setLead(Number(e.target.value) || 0)}
              min={0}
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-500/30 bg-emerald-500/5 p-4 space-y-2">
        <p className="text-xs uppercase tracking-wide text-indigo-600">
          Simulated outcome
        </p>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-emerald-700/80">Effective stock</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-800">
              {derived.effectiveStock}
            </p>
          </div>

          <div>
            <p className="text-xs text-emerald-700/80">Days until run out</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-800">
              {days != null ? days : "—"}
            </p>
          </div>

          <div>
            <p className="text-xs text-emerald-700/80">Run-out date</p>
            <p className="mt-1 text-base font-semibold text-emerald-800">
              {fmtGB(derived.runOutDate)}
            </p>
          </div>

          <div>
            <p className="text-xs text-emerald-700/80">Order-by date</p>
            <p className="mt-1 text-base font-semibold text-emerald-800">
              {fmtGB(derived.orderByDate)}
            </p>
          </div>
        </div>

        <p className="mt-1 text-[11px] text-emerald-700/70">
          Uses the same logic as the main dashboard: effective stock ÷ daily demand,
          then shifts back by lead time for order-by.
        </p>
      </div>
    </section>
  );
}


