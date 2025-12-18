"use client";

import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export type SalesHistoryPoint = {
  ym: string; // "YYYY-MM"
  label: string; // e.g. "2024-12"
  unitsSold: number;
};

function formatYM(ym: string) {
  // "2024-12" -> "Dec 2024"
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export default function SalesHistoryChart({
  title = "Sales history",
  data,
}: {
  title?: string;
  data: SalesHistoryPoint[];
}) {
  const [range, setRange] = useState<"12" | "24" | "all">("12");

  const sliced = useMemo(() => {
    if (range === "all") return data;
    const n = range === "24" ? 24 : 12;
    return data.slice(-n);
  }, [data, range]);

  const maxY = useMemo(() => {
    const m = Math.max(...sliced.map((d) => d.unitsSold), 0);
    return m <= 0 ? 1 : m;
  }, [sliced]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <p className="text-xs text-slate-400">
            Hover to see exact units sold per month.
          </p>
        </div>

        <div className="flex gap-2 text-xs">
          {(["12", "24", "all"] as const).map((k) => {
            const active = range === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setRange(k)}
                className={`rounded-full border px-3 py-1.5 transition ${
                  active
                    ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-100"
                    : "border-slate-700/80 bg-slate-950/40 text-slate-200 hover:bg-slate-900/60"
                }`}
              >
                {k === "all" ? "All" : `Last ${k}`}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sliced} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" opacity={0.2} />
            <XAxis
              dataKey="ym"
              tickFormatter={formatYM}
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, Math.ceil(maxY * 1.15)]}
              tick={{ fontSize: 11 }}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(2, 6, 23, 0.95)",
                border: "1px solid rgba(148, 163, 184, 0.25)",
                borderRadius: 12,
                color: "#e2e8f0",
              }}
              labelFormatter={(ym) => formatYM(String(ym))}
              formatter={(value) => [`${value} units`, "Units Sold"]}
            />
            <Line
              type="monotone"
              dataKey="unitsSold"
              stroke="rgba(52, 211, 153, 0.9)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
