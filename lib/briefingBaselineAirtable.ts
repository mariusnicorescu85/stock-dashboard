import type { StockBriefing } from "./stockBriefing";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

export type BriefingBaselineSnapshot = {
  /** Calendar date saved from the last cron write (YYYY-MM-DD). */
  snapshotAtYmd: string;
  critical0to7: number;
  urgent8to14: number;
  watch15to30: number;
  reorderSkuCount: number;
};

export type BriefingBaselineDelta = {
  previousSnapshotYmd: string;
  /** Short human lines for the UI, e.g. "Critical (0–7d): was 3, now 5 (+2)". */
  lines: string[];
};

function num(f: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = f[k];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function dateYmd(f: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = f[k];
    if (v == null || v === "") continue;
    if (typeof v === "string") {
      const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
      if (m) return m[1]!;
    }
  }
  return null;
}

/**
 * Reads the single baseline record (same record the cron PATCHes).
 * Env: AIRTABLE_BRIEFING_BASELINE_TABLE, AIRTABLE_BRIEFING_BASELINE_RECORD_ID
 */
export async function fetchBriefingBaselineSnapshot(): Promise<BriefingBaselineSnapshot | null> {
  const table = process.env.AIRTABLE_BRIEFING_BASELINE_TABLE?.trim();
  const recordId = process.env.AIRTABLE_BRIEFING_BASELINE_RECORD_ID?.trim();
  if (!table || !recordId || !AIRTABLE_API_KEY?.trim() || !AIRTABLE_BASE_ID?.trim()) {
    return null;
  }

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    table
  )}/${recordId}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("Briefing baseline fetch failed:", await res.text().then((t) => t.slice(0, 400)));
    return null;
  }

  const data = (await res.json()) as { fields?: Record<string, unknown> };
  const f = data.fields ?? {};
  const snapshotAtYmd =
    dateYmd(f, "Snapshot At", "Briefing snapshot at", "Briefing Snapshot At") ??
    "";

  if (!snapshotAtYmd) return null;

  return {
    snapshotAtYmd,
    critical0to7: num(f, "Critical 0-7", "Critical 0–7", "critical_0_7"),
    urgent8to14: num(f, "Urgent 8-14", "Urgent 8–14", "urgent_8_14"),
    watch15to30: num(f, "Watch 15-30", "Watch 15–30", "watch_15_30"),
    reorderSkuCount: num(f, "Reorder SKU Count", "Reorder queue count", "Reorder SKU count"),
  };
}

function deltaLine(label: string, before: number, after: number): string {
  const d = after - before;
  const sign = d > 0 ? "+" : "";
  return `${label}: was ${before}, now ${after} (${sign}${d})`;
}

export function computeBriefingBaselineDelta(
  prev: BriefingBaselineSnapshot | null,
  briefing: StockBriefing
): BriefingBaselineDelta | null {
  if (!prev) return null;

  const lines: string[] = [];

  if (prev.critical0to7 !== briefing.critical0to7) {
    lines.push(deltaLine("Critical (0–7 days)", prev.critical0to7, briefing.critical0to7));
  }
  if (prev.urgent8to14 !== briefing.urgent8to14) {
    lines.push(deltaLine("Urgent (8–14 days)", prev.urgent8to14, briefing.urgent8to14));
  }
  if (prev.watch15to30 !== briefing.watch15to30) {
    lines.push(deltaLine("Watch (15–30 days)", prev.watch15to30, briefing.watch15to30));
  }
  if (prev.reorderSkuCount !== briefing.reorderSkuCount) {
    lines.push(
      deltaLine("Buying list (product count)", prev.reorderSkuCount, briefing.reorderSkuCount)
    );
  }

  if (lines.length === 0) return null;

  return {
    previousSnapshotYmd: prev.snapshotAtYmd,
    lines,
  };
}

export type BriefingBaselineUpsertResult = {
  saved: boolean;
  /** Why the write was skipped (missing env), or Airtable error body snippet. */
  message?: string;
};

/**
 * Persists today’s briefing metrics for the next run’s delta. Call from a trusted cron only.
 * Does nothing on server start — only when this function runs (e.g. GET /api/cron/stock-briefing).
 */
export async function upsertBriefingBaselineFromBriefing(
  briefing: StockBriefing
): Promise<BriefingBaselineUpsertResult> {
  const table = process.env.AIRTABLE_BRIEFING_BASELINE_TABLE?.trim();
  const recordId = process.env.AIRTABLE_BRIEFING_BASELINE_RECORD_ID?.trim();
  if (!table || !recordId) {
    const message =
      "Set AIRTABLE_BRIEFING_BASELINE_TABLE and AIRTABLE_BRIEFING_BASELINE_RECORD_ID in .env.local";
    console.warn("Briefing baseline: skipped —", message);
    return { saved: false, message };
  }
  if (!AIRTABLE_API_KEY?.trim() || !AIRTABLE_BASE_ID?.trim()) {
    const message = "Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID";
    console.warn("Briefing baseline: skipped —", message);
    return { saved: false, message };
  }

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    table
  )}/${recordId}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        "Snapshot At": briefing.todayYmd,
        "Critical 0-7": briefing.critical0to7,
        "Urgent 8-14": briefing.urgent8to14,
        "Watch 15-30": briefing.watch15to30,
        "Reorder SKU Count": briefing.reorderSkuCount,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Briefing baseline PATCH failed:", res.status, errText.slice(0, 500));
    return { saved: false, message: errText.slice(0, 300) };
  }

  console.log(
    "Briefing baseline: saved to Airtable",
    JSON.stringify({ recordId, snapshotAt: briefing.todayYmd })
  );
  return { saved: true };
}
