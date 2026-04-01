"use client";

import { useEffect, useState } from "react";
import type { BriefingDecision, BriefingDecisionSeverity } from "@/lib/briefingDecisions";

function severityStyles(s: BriefingDecisionSeverity): {
  border: string;
  badge: string;
  title: string;
} {
  switch (s) {
    case "critical":
      return {
        border: "border-red-500/35 bg-red-950/30",
        badge: "bg-red-500/20 text-red-200 border-red-400/35",
        title: "text-red-100",
      };
    case "high":
      return {
        border: "border-amber-500/35 bg-amber-950/20",
        badge: "bg-amber-500/20 text-amber-200 border-amber-400/35",
        title: "text-amber-100",
      };
    case "medium":
      return {
        border: "border-slate-600/60 bg-slate-900/50",
        badge: "bg-slate-600/30 text-slate-200 border-slate-500/35",
        title: "text-slate-100",
      };
    default:
      return {
        border: "border-emerald-500/25 bg-emerald-950/15",
        badge: "bg-emerald-500/15 text-emerald-200/90 border-emerald-500/25",
        title: "text-emerald-100/90",
      };
  }
}

function severityLabel(s: BriefingDecisionSeverity): string {
  if (s === "critical") return "Needs attention now";
  if (s === "high") return "Important";
  if (s === "medium") return "Worth planning";
  return "All clear";
}

export default function BriefingDecisionsPanel({ decisions }: { decisions: BriefingDecision[] }) {
  const idKey = decisions.map((d) => d.id).join("|");
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(decisions.map((d) => [d.id, d.severity === "critical"]))
  );

  useEffect(() => {
    setExpandedById(
      Object.fromEntries(decisions.map((d) => [d.id, d.severity === "critical"]))
    );
  }, [idKey]);

  if (decisions.length === 0) return null;

  function toggle(id: string) {
    setExpandedById((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const allExpanded = decisions.every((d) => expandedById[d.id]);
  function expandAll() {
    setExpandedById(Object.fromEntries(decisions.map((d) => [d.id, true])));
  }
  function collapseNonCritical() {
    setExpandedById(
      Object.fromEntries(
        decisions.map((d) => [d.id, d.severity === "critical"])
      )
    );
  }

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/25 to-slate-950/40 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-200/85">
            What we suggest you do
          </h2>
          <p className="text-[11px] text-slate-500 max-w-xl">
            Scan the titles first. Open a card only when you want the full reasoning and checklist.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => (allExpanded ? collapseNonCritical() : expandAll())}
            className="rounded-lg border border-slate-600/80 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800/80"
          >
            {allExpanded ? "Shorter view" : "Expand all"}
          </button>
        </div>
      </div>
      <ul className="space-y-2">
        {decisions.map((d) => {
          const st = severityStyles(d.severity);
          const open = expandedById[d.id] ?? false;
          return (
            <li
              key={d.id}
              className={`rounded-xl border overflow-hidden ${st.border}`}
            >
              <button
                type="button"
                onClick={() => toggle(d.id)}
                aria-expanded={open}
                className="flex w-full items-start gap-2 text-left p-3 sm:p-4 hover:bg-white/[0.03] transition-colors"
              >
                <span
                  className={`mt-0.5 shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${st.badge}`}
                >
                  {severityLabel(d.severity)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold leading-snug ${st.title}`}>
                    {d.title}
                  </span>
                  {!open && d.suggestedActions[0] ? (
                    <span className="mt-1 block text-xs text-slate-500 line-clamp-2">
                      {d.suggestedActions[0]}
                    </span>
                  ) : null}
                </span>
                <span
                  className="shrink-0 text-slate-500 tabular-nums text-lg leading-none pt-0.5 w-6 text-center"
                  aria-hidden
                >
                  {open ? "−" : "+"}
                </span>
              </button>
              {open ? (
                <div className="px-4 pb-4 pt-0 space-y-2.5 border-t border-white/[0.06]">
                  <ul className="list-disc pl-4 text-xs text-slate-400 space-y-1 leading-relaxed">
                    {d.rationale.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      Practical next steps
                    </p>
                    <ul className="list-disc pl-4 text-xs text-slate-300 space-y-0.5">
                      {d.suggestedActions.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                  {d.relatedProductNames && d.relatedProductNames.length > 0 ? (
                    <p className="text-[11px] text-slate-500">
                      <span className="text-slate-500">Products: </span>
                      <span className="text-slate-400">{d.relatedProductNames.join(", ")}</span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
