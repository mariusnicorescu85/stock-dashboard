"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BriefingTopReorder } from "@/lib/stockBriefing";

const STORAGE_KEY = "stock-dash-cron-secret";

type Action =
  | "snooze3"
  | "snooze7"
  | "snooze14"
  | "clearSnooze"
  | "markOrdered"
  | "clearOrdered";

export default function BriefingProductSignalButtons({
  row,
}: {
  row: Pick<BriefingTopReorder, "id" | "airtableTable" | "name">;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const table = row.airtableTable?.trim();
  if (!table) {
    return <span className="text-[10px] text-slate-600">—</span>;
  }

  async function run(action: Action) {
    let secret: string;
    try {
      secret = sessionStorage.getItem(STORAGE_KEY) || "";
    } catch {
      secret = "";
    }
    secret = secret.trim();
    if (!secret) {
      window.alert(
        "Enter your cron secret in “Airtable from dashboard” above and optional “Remember in this browser”."
      );
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/briefing/product-signals", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordId: row.id,
          sourceTable: table,
          action,
        }),
      });
      const data = (await res.json()) as { error?: string; detail?: string };
      if (!res.ok) {
        window.alert(data.error || data.detail || `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "rounded-md border border-slate-600/80 bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40";

  return (
    <div className="flex flex-col gap-1 min-w-[7.5rem]">
      <span className="text-[9px] uppercase tracking-wide text-slate-500">Snooze</span>
      <div className="flex flex-wrap gap-0.5">
        <button type="button" disabled={busy} className={btn} onClick={() => run("snooze3")}>
          +3d
        </button>
        <button type="button" disabled={busy} className={btn} onClick={() => run("snooze7")}>
          +7d
        </button>
        <button type="button" disabled={busy} className={btn} onClick={() => run("snooze14")}>
          +14d
        </button>
        <button type="button" disabled={busy} className={btn} onClick={() => run("clearSnooze")}>
          Clear
        </button>
      </div>
      <span className="text-[9px] uppercase tracking-wide text-slate-500">Order</span>
      <div className="flex flex-wrap gap-0.5">
        <button type="button" disabled={busy} className={btn} onClick={() => run("markOrdered")}>
          Placed today
        </button>
        <button type="button" disabled={busy} className={btn} onClick={() => run("clearOrdered")}>
          Clear
        </button>
      </div>
    </div>
  );
}
