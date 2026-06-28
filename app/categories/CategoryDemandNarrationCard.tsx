import type { CategoryDemandNarrationResult } from "@/lib/categoryDemandNarrationOpenAI";

export default function CategoryDemandNarrationCard({
  narration,
  caption,
}: {
  narration: CategoryDemandNarrationResult;
  caption?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-zinc-50 p-4 space-y-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200/85">
          Category demand (AI overview)
        </p>
        <p className="text-[10px] text-zinc-500 max-w-md text-right">
          {caption?.trim()
            ? caption
            : "Reworded from category totals for this page — check the tables for detail."}
        </p>
      </div>
      <p className="text-sm text-zinc-800 leading-relaxed">{narration.overview}</p>
      {narration.standouts.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">
            Worth a look
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-sm text-zinc-600">
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
