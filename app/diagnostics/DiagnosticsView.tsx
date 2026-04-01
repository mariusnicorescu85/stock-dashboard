"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DiagnosticCheck, DiagnosticsReport } from "@/lib/diagnosticsTypes";

const staggerMs = 280;

function statusStyles(status: DiagnosticCheck["status"]) {
  if (status === "ok")
    return {
      ring: "border-emerald-500/40 bg-emerald-500/[0.08]",
      dot: "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]",
      label: "text-emerald-200",
      badge: "bg-emerald-500/15 text-emerald-200 border-emerald-500/35",
    };
  if (status === "warn")
    return {
      ring: "border-amber-500/40 bg-amber-500/[0.07]",
      dot: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]",
      label: "text-amber-200",
      badge: "bg-amber-500/15 text-amber-100 border-amber-500/35",
    };
  return {
    ring: "border-red-500/45 bg-red-500/[0.08]",
    dot: "bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.45)]",
    label: "text-red-200",
    badge: "bg-red-500/15 text-red-100 border-red-500/40",
  };
}

function overallBanner(overall: DiagnosticsReport["overall"]) {
  if (overall === "ok")
    return {
      border: "border-emerald-500/50",
      bg: "bg-emerald-500/[0.12]",
      title: "All checks passed",
      sub: "Configuration and the live Airtable probe look good.",
      dot: "bg-emerald-400",
    };
  if (overall === "warn")
    return {
      border: "border-amber-500/45",
      bg: "bg-amber-500/[0.1]",
      title: "Attention needed",
      sub: "No blocking errors, but some items should be reviewed.",
      dot: "bg-amber-400",
    };
  return {
    border: "border-red-500/50",
    bg: "bg-red-500/[0.1]",
    title: "Problems detected",
    sub: "Fix failed checks before relying on production behavior.",
    dot: "bg-red-400",
  };
}

export function DiagnosticsView({ report }: { report: DiagnosticsReport }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    setRevealed(0);
    if (report.checks.length === 0) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setRevealed((n) => Math.min(n + 1, report.checks.length));
      if (i >= report.checks.length) window.clearInterval(id);
    }, staggerMs);
    return () => window.clearInterval(id);
  }, [report.checks, report.finishedAtIso]);

  const banner = overallBanner(report.overall);

  return (
    <div className="space-y-8">
      <div
        className={`rounded-2xl border px-5 py-4 ${banner.border} ${banner.bg} shadow-[0_20px_50px_rgba(0,0,0,0.35)]`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${banner.dot} ring-2 ring-white/10`}
              aria-hidden
            />
            <div>
              <h2 className={`text-lg font-semibold ${report.overall === "ok" ? "text-emerald-100" : report.overall === "warn" ? "text-amber-50" : "text-red-50"}`}>
                {banner.title}
              </h2>
              <p className="mt-1 text-sm text-slate-300/95 max-w-2xl">{report.summary}</p>
              <p className="mt-2 font-mono text-[11px] text-slate-500">
                Finished in {report.durationMs}ms · {report.finishedAtIso}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => router.refresh())}
            className="mt-3 sm:mt-0 h-10 shrink-0 rounded-xl border border-slate-600 bg-slate-950/50 px-4 text-sm font-medium text-slate-200 hover:bg-slate-900/80 disabled:opacity-50"
          >
            {pending ? "Running…" : "Run checks again"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Check sequence
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Steps run in order on the server; each row appears as the report replays the sequence.
        </p>
        <ol className="mt-6 space-y-3">
          {report.checks.map((check, idx) => {
            const shown = idx < revealed;
            const s = statusStyles(check.status);
            return (
              <li
                key={`${check.id}-${check.order}`}
                className={`rounded-xl border px-4 py-3 transition-all duration-500 ${
                  shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                } ${s.ring}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3 min-w-0">
                    <span className="font-mono text-xs text-slate-500 tabular-nums w-6 shrink-0 pt-0.5">
                      {check.order.toString().padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} aria-hidden />
                        <span className={`font-medium ${s.label}`}>{check.title}</span>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.badge}`}
                        >
                          {check.status === "ok" ? "OK" : check.status === "warn" ? "Warning" : "Failed"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{check.description}</p>
                      {check.detail ? (
                        <p className="mt-2 font-mono text-xs text-slate-300/90 break-words">
                          {check.detail}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
