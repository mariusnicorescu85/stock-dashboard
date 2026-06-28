"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

export default function AirtableBriefingTools({
  variant = "default",
}: {
  /** Slightly tighter layout when embedded on briefing page */
  variant?: "default" | "compact";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const saveBaseline = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/briefing/baseline", { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        todayYmd?: string;
        baselineSnapshot?: { saved?: boolean; message?: string };
      };

      if (!res.ok) {
        setMessage(data.error || `Request failed (${res.status})`);
        return;
      }

      if (data.baselineSnapshot?.saved) {
        setMessage(
          `Baseline saved for ${data.todayYmd ?? "today"}. Page refreshed — on All shops you can compare to this snapshot.`
        );
        router.refresh();
      } else {
        setMessage(
          data.baselineSnapshot?.message?.slice(0, 200) ||
            "Baseline did not save — check env and Airtable fields."
        );
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }, [router]);

  const pad = variant === "compact" ? "p-3" : "p-4";

  return (
    <div
      className={`rounded-2xl border border-zinc-200 bg-white ${pad} space-y-3`}
    >
      <div className="space-y-0.5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Briefing baseline
        </h3>
        <p className="text-[11px] text-zinc-500 max-w-xl">
          Saves today&apos;s headline reorder counts to Airtable for comparison on the briefing page (All shops).
          You must be <span className="text-zinc-500">signed in</span>.
        </p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={saveBaseline}
        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save briefing snapshot"}
      </button>

      {message ? (
        <p className="text-xs text-zinc-600 whitespace-pre-wrap break-words">{message}</p>
      ) : null}
    </div>
  );
}
