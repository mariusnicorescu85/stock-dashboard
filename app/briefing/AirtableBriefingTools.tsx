"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "stock-dash-cron-secret";

export default function AirtableBriefingTools({
  variant = "default",
}: {
  /** Slightly tighter layout when embedded on briefing page */
  variant?: "default" | "compact";
}) {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const s = sessionStorage.getItem(STORAGE_KEY);
      if (s) setSecret(s);
    } catch {
      /* ignore */
    }
  }, []);

  const authHeader = useCallback(() => {
    const s = secret.trim();
    if (!s) return null;
    return `Bearer ${s}`;
  }, [secret]);

  const saveBaseline = async () => {
    const auth = authHeader();
    if (!auth) {
      setMessage("Enter your cron secret first (same as CRON_SECRET / n8n).");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/briefing/baseline", {
        method: "POST",
        headers: { Authorization: auth },
      });
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
        try {
          if (remember) sessionStorage.setItem(STORAGE_KEY, secret.trim());
          else sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
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
  };

  const pad = variant === "compact" ? "p-3" : "p-4";

  return (
    <div
      className={`rounded-2xl border border-slate-600/50 bg-slate-900/50 ${pad} space-y-3`}
    >
      <div className="space-y-0.5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Airtable from dashboard
        </h3>
        <p className="text-[11px] text-slate-500 max-w-xl">
          Uses the same <span className="text-slate-400">CRON_SECRET</span> as your n8n HTTP node.
          Stored in this browser only if you tick remember. Row actions below use it too.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-end">
        <label className="flex flex-col gap-1 min-w-[200px] flex-1">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Cron secret</span>
          <input
            type="password"
            autoComplete="off"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
            placeholder="Paste CRON_SECRET"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer shrink-0 pb-1">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="rounded border-slate-600 bg-slate-950"
          />
          Remember in this browser
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={saveBaseline}
          className="shrink-0 rounded-xl bg-emerald-600/90 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save briefing snapshot"}
        </button>
      </div>

      {message ? (
        <p className="text-xs text-slate-300 whitespace-pre-wrap break-words">{message}</p>
      ) : null}
    </div>
  );
}
