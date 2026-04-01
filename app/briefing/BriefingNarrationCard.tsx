import type { BriefingNarrationResult } from "@/lib/briefingNarrationOpenAI";

export default function BriefingNarrationCard({
  narration,
}: {
  narration: BriefingNarrationResult;
}) {
  return (
    <div className="rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-950/35 via-slate-900/40 to-slate-950/70 p-4 space-y-3 shadow-[0_16px_48px_rgba(0,0,0,0.2)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/85">
          Plain-English summary (AI)
        </p>
        <p className="text-[10px] text-slate-500 max-w-md text-right">
          Reworded for readability — the real detail is in “What we suggest you do” above.
        </p>
      </div>
      <p className="text-sm text-slate-200 leading-relaxed">{narration.executiveSummary}</p>
      {narration.topMoves.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Three things to focus on
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-300">
            {narration.topMoves.map((m, i) => (
              <li key={i} title={m.decisionId ?? undefined}>
                {m.move}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
