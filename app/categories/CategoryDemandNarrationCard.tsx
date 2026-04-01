import type { CategoryDemandNarrationResult } from "@/lib/categoryDemandNarrationOpenAI";

export default function CategoryDemandNarrationCard({
  narration,
  caption,
}: {
  narration: CategoryDemandNarrationResult;
  caption?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/30 via-slate-900/40 to-slate-950/70 p-4 space-y-3 shadow-[0_16px_48px_rgba(0,0,0,0.2)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/85">
          Category demand (AI overview)
        </p>
        <p className="text-[10px] text-slate-500 max-w-md text-right">
          {caption?.trim()
            ? caption
            : "Reworded from category totals for this page — check the tables for detail."}
        </p>
      </div>
      <p className="text-sm text-slate-200 leading-relaxed">{narration.overview}</p>
      {narration.standouts.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Worth a look
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-300">
            {narration.standouts.map((s, i) => (
              <li key={i} title={s.categoryId ?? undefined}>
                {s.note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
