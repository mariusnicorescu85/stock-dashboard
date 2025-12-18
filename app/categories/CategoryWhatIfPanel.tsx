"use client";

import React, { useState } from "react";
import { computeStockDerived, fmtGB } from "@/lib/StockMath";

type Props = {
  label: string;
  initialCurrentStock: number;
  initialIncomingStock: number;
  initialDailyDemand: number;
  initialLeadTimeDays: number;
};

export default function CategoryWhatIfPanel({
  label,
  initialCurrentStock,
  initialIncomingStock,
  initialDailyDemand,
  initialLeadTimeDays,
}: Props) {
  const [cur, setCur] = useState<number>(initialCurrentStock);
  const [incoming, setIncoming] = useState<number>(initialIncomingStock);
  const [daily, setDaily] = useState<number>(initialDailyDemand);
  const [lead, setLead] = useState<number>(initialLeadTimeDays);

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
    <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:grid-cols-2">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-slate-400">
          What if we adjust this category?
        </p>
        <p className="text-xs text-slate-500">
          Simulate total runway for <span className="font-semibold">{label}</span>{" "}
          without changing Airtable.
        </p>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-[11px] uppercase tracking-wide text-slate-400">
              Total current stock
            </span>
            <input
              type="number"
              className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-sm text-slate-100"
              value={cur}
              onChange={(e) => setCur(Number(e.target.value) || 0)}
              min={0}
            />
          </label>

          <label className="space-y-1">
            <span className="block text-[11px] uppercase tracking-wide text-slate-400">
              Total incoming stock
            </span>
            <input
              type="number"
              className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-sm text-slate-100"
              value={incoming}
              onChange={(e) => setIncoming(Number(e.target.value) || 0)}
              min={0}
            />
          </label>

          <label className="space-y-1">
            <span className="block text-[11px] uppercase tracking-wide text-slate-400">
              Daily demand (sum, units/day)
            </span>
            <input
              type="number"
              className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-sm text-slate-100"
              value={daily}
              onChange={(e) => setDaily(Number(e.target.value) || 0)}
              min={0}
              step={0.1}
            />
          </label>

          <label className="space-y-1">
            <span className="block text-[11px] uppercase tracking-wide text-slate-400">
              Lead time (days)
            </span>
            <input
              type="number"
              className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-sm text-slate-100"
              value={lead}
              onChange={(e) => setLead(Number(e.target.value) || 0)}
              min={0}
            />
          </label>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3">
        <p className="text-xs uppercase tracking-wide text-emerald-300">
          Simulated category outcome
        </p>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-[11px] text-emerald-200/80">Effective stock</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-100">
              {derived.effectiveStock}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-emerald-200/80">
              Days until run out
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-100">
              {days != null ? days : "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-emerald-200/80">Run-out date</p>
            <p className="mt-1 text-base font-semibold text-emerald-100">
              {fmtGB(derived.runOutDate)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-emerald-200/80">Order-by date</p>
            <p className="mt-1 text-base font-semibold text-emerald-100">
              {fmtGB(derived.orderByDate)}
            </p>
          </div>
        </div>

        <p className="mt-1 text-[11px] text-emerald-200/70">
          Uses the same formula as individual products: total stock ÷ total
          daily demand, then subtract lead time for order-by.
        </p>
      </div>
    </div>
  );
}


