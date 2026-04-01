import type { BriefingDecision } from "./briefingDecisions";
import type { BriefingSalesNarrative } from "./briefingSalesInsights";
import type { StockBriefing } from "./stockBriefing";

/** Structured facts passed to the model — no secrets; all numbers come from your app. */
export type BriefingNarrationPayload = {
  dateLabel: string;
  scope: string;
  calendarMonthFocus: string;
  /** Same copy as the briefing “what to order” blurb — from `buildReorderGuidance`. */
  reorderGuidance: string;
  /** Per-shop top sellers for the calendar month (rank, name, trend line, lifetime units in month). */
  shopTopProducts: Array<{
    shopLabel: string;
    topProducts: Array<{
      rank: number;
      productName: string;
      trendSummary: string;
      totalUnitsAllYears: number;
    }>;
  }>;
  metrics: {
    critical0to7: number;
    urgent8to14: number;
    watch15to30: number;
    planning31to60: number;
    reorderSkuCount: number;
    totalUnitsToOrder: number;
    reorderQueueHasOverdueOrderBy: boolean;
  };
  decisions: Array<{
    id: string;
    severity: string;
    title: string;
    rationale: string[];
    suggestedActions: string[];
    relatedProductNames?: string[];
  }>;
};

export type BriefingNarrationResult = {
  executiveSummary: string;
  topMoves: Array<{ decisionId: string | null; move: string }>;
};

export function buildBriefingNarrationPayload(
  briefing: StockBriefing,
  decisions: BriefingDecision[],
  scopeLabel: string,
  salesNarrative: BriefingSalesNarrative
): BriefingNarrationPayload {
  return {
    dateLabel: briefing.dateLabel,
    scope: scopeLabel,
    calendarMonthFocus: salesNarrative.monthLabel,
    reorderGuidance: salesNarrative.reorderGuidance,
    shopTopProducts: salesNarrative.shopBlocks.map((b) => ({
      shopLabel: b.shopLabel,
      topProducts: b.topProducts.map((p) => ({
        rank: p.rank,
        productName: p.productName,
        trendSummary: p.trendSummary,
        totalUnitsAllYears: p.totalUnitsAllYears,
      })),
    })),
    metrics: {
      critical0to7: briefing.critical0to7,
      urgent8to14: briefing.urgent8to14,
      watch15to30: briefing.watch15to30,
      planning31to60: briefing.planning31to60,
      reorderSkuCount: briefing.reorderSkuCount,
      totalUnitsToOrder: briefing.totalUnitsToOrder,
      reorderQueueHasOverdueOrderBy: briefing.reorderQueueHasOverdueOrderBy,
    },
    decisions: decisions.map((d) => ({
      id: d.id,
      severity: d.severity,
      title: d.title,
      rationale: d.rationale,
      suggestedActions: d.suggestedActions,
      relatedProductNames: d.relatedProductNames,
    })),
  };
}

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `You help shop owners and buyers understand a daily stock briefing.

The user message is ONLY a JSON object with: dateLabel, scope, calendarMonthFocus, reorderGuidance, shopTopProducts, metrics, and decisions (already computed in software).

STRICT RULES:
- Use plain, friendly English anyone can follow. Avoid jargon: prefer “running low” over “runway”, “buying list” over “reorder queue”, “products” over “SKUs” unless the JSON names a specific count of lines.
- Rephrase ONLY what appears in the JSON. Do NOT invent product names, numbers, dates, money, suppliers, or risks.
- If something is not in the JSON, do not mention it.
- You may blend wording from: decisions[].title, rationale, suggestedActions; reorderGuidance; shopTopProducts[].topProducts (productName, trendSummary, rank, totalUnitsAllYears, shopLabel) — never add new facts or figures.
- In the executiveSummary, where it fits, briefly connect stock pressure (metrics/decisions) with this month’s best sellers (shopTopProducts) and the buying suggestion (reorderGuidance) — still only using words/numbers present in the JSON.
- executiveSummary: 3–5 short sentences as if briefing a busy owner.
- topMoves: at most 3 bullets; fewer if fewer decisions merit emphasis. Each bullet is one simple action (“Order X first…”). Prefer the most urgent decisions first (critical, then high, then medium).
- For each topMoves item, decisionId must match an exact decisions[].id from the input when the bullet clearly reflects that item; else null.

Output valid JSON only:
{"executiveSummary":"string","topMoves":[{"decisionId":"string or null","move":"string"}]}`;

type RawOpenAI = {
  choices?: Array<{ message?: { content?: string } }>;
};

type RawNarration = {
  executiveSummary?: string;
  topMoves?: Array<{ decisionId?: string | null; move?: string }>;
};

function sanitizeNarration(
  raw: RawNarration,
  validIds: Set<string>
): BriefingNarrationResult | null {
  const executiveSummary =
    typeof raw.executiveSummary === "string" ? raw.executiveSummary.trim() : "";
  if (!executiveSummary) return null;

  const topMoves: BriefingNarrationResult["topMoves"] = [];
  const arr = Array.isArray(raw.topMoves) ? raw.topMoves : [];

  for (const item of arr.slice(0, 3)) {
    const move = typeof item?.move === "string" ? item.move.trim() : "";
    if (!move) continue;
    let decisionId: string | null = null;
    if (typeof item?.decisionId === "string" && validIds.has(item.decisionId)) {
      decisionId = item.decisionId;
    }
    topMoves.push({ decisionId, move });
  }

  return { executiveSummary, topMoves };
}

/**
 * Calls OpenAI from the server. Set OPENAI_API_KEY in .env.local.
 * Optional: OPENAI_BRIEFING_MODEL (default gpt-4o-mini).
 * Returns null if key missing, HTTP error, parse error, or empty summary.
 */
export async function fetchBriefingNarrationOpenAI(
  payload: BriefingNarrationPayload
): Promise<BriefingNarrationResult | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const model = process.env.OPENAI_BRIEFING_MODEL?.trim() || "gpt-4o-mini";
  const validIds = new Set(payload.decisions.map((d) => d.id));

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Briefing facts as JSON. Produce executiveSummary and topMoves only.\n\n${JSON.stringify(payload)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(28_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenAI briefing narration HTTP error:", res.status, errText.slice(0, 500));
      return null;
    }

    const data = (await res.json()) as RawOpenAI;
    const content = data.choices?.[0]?.message?.content;
    if (!content?.trim()) return null;

    let parsed: RawNarration;
    try {
      parsed = JSON.parse(content) as RawNarration;
    } catch {
      console.error("OpenAI briefing narration: invalid JSON in message content");
      return null;
    }

    return sanitizeNarration(parsed, validIds);
  } catch (e) {
    console.error("OpenAI briefing narration failed:", e);
    return null;
  }
}
