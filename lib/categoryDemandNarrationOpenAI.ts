const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export type CategoryDemandBlockForNarration = {
  id: string;
  label: string;
  description: string;
  totalsByYear: { year: number; total: number }[];
  totalCurrentStock: number;
  totalDailyDemand: number;
  hideStockRunoutColumns?: boolean;
  items: Array<{
    name: string;
    qtyToOrder: number;
    byYear: Array<{ year: number; totalUnits: number; months: number[] }>;
  }>;
};

/** How demand units in this payload are aggregated for YoY comparisons. */
export type CategoryDemandWindow =
  | { kind: "fullYear"; note: string }
  | {
      kind: "sameMonthsPartial";
      /** Inclusive calendar month numbers (1 = January), same slice applied to every year. */
      monthStart1: number;
      monthEnd1: number;
      /** Tells the model these figures are NOT full-year totals. */
      note: string;
    };

export type CategoryDemandNarrationPayload = {
  /** Which year the page emphasizes in tables — not the only year to discuss. */
  primaryYear: number;
  /** Every calendar year loaded (e.g. 2024, 2025, 2026); overview must cover all of these. */
  historyYearsAsc: number[];
  demandWindow: CategoryDemandWindow;
  /** Comparable demand totals per year — full calendar year OR same partial months per demandWindow. */
  aggregateUnitsByYear: { year: number; totalUnits: number }[];
  shopScopeLabel: string;
  dateNote: string;
  categories: Array<{
    id: string;
    label: string;
    description: string;
    totalsByYear: { year: number; total: number }[];
    productLineCount: number;
    totalCurrentStock: number;
    totalDailyDemand: number;
    totalQtyToOrder: number;
    linesNeedingOrder: number;
    demandOnly: boolean;
    topLinesPrimaryYear: Array<{ name: string; units: number }>;
    /** Top lines by sum of units across all historyYearsAsc (same names as rows below). */
    topLinesAcrossHistory: Array<{ name: string; unitsSumHistory: number }>;
  }>;
};

export type CategoryDemandNarrationResult = {
  overview: string;
  standouts: Array<{ categoryId: string | null; note: string }>;
};

function monthNameEn(month1Based: number): string {
  return new Date(2000, month1Based - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
  });
}

/** Last fully completed calendar month (0-based index). January ⇒ null (no completed month yet). */
export function lastCompletedMonthIndex0(now = new Date()): number | null {
  const idx = now.getMonth() - 1;
  return idx >= 0 ? idx : null;
}

/**
 * When the user’s primary year is the current calendar year, compare only the same
 * elapsed months (e.g. Jan–Feb) across all loaded years — not full 2026 vs full 2025.
 */
export function resolveCategoryDemandWindow(
  now: Date,
  primaryYear: number
): CategoryDemandWindow {
  const endIdx = lastCompletedMonthIndex0(now);
  if (endIdx === null || primaryYear !== now.getFullYear()) {
    return {
      kind: "fullYear",
      note: "totalsByYear and aggregateUnitsByYear are full calendar-year unit sums per year.",
    };
  }
  const monthStart1 = 1;
  const monthEnd1 = endIdx + 1;
  const note = `Demand figures are summed only for ${monthNameEn(monthStart1)} through ${monthNameEn(monthEnd1)} in each calendar year (same months for every year in historyYearsAsc). Do not treat them as full-year totals. The primary year is still in progress.`;
  return { kind: "sameMonthsPartial", monthStart1, monthEnd1, note };
}

/** Short line for UI next to the AI category card. */
export function categoryDemandWindowCaption(w: CategoryDemandWindow): string {
  if (w.kind === "fullYear") {
    return "AI uses full calendar-year demand per year.";
  }
  return `AI compares ${monthNameEn(w.monthStart1)}–${monthNameEn(w.monthEnd1)} units in each year only — not full-year totals.`;
}

function sumMonthsInclusive(
  months: number[] | undefined,
  startIdx0: number,
  endIdx0Inclusive: number
): number {
  const m = months ?? [];
  let s = 0;
  for (let i = startIdx0; i <= endIdx0Inclusive && i < 12; i++) s += m[i] ?? 0;
  return s;
}

function unitsForSlice(
  slice: CategoryDemandBlockForNarration["items"][number]["byYear"][number],
  window: CategoryDemandWindow
): number {
  if (window.kind === "fullYear") return slice.totalUnits;
  const end = window.monthEnd1 - 1;
  const start = window.monthStart1 - 1;
  return sumMonthsInclusive(slice.months, start, end);
}

function unitsForItemYear(
  item: CategoryDemandBlockForNarration["items"][number],
  y: number,
  window: CategoryDemandWindow
): number {
  const slice = item.byYear.find((x) => x.year === y);
  if (!slice) return 0;
  return unitsForSlice(slice, window);
}

export function buildCategoryDemandNarrationPayload(input: {
  primaryYear: number;
  historyYearsAsc: number[];
  shopScopeLabel: string;
  blocks: CategoryDemandBlockForNarration[];
  /** Defaults to `new Date()` (server “today”). */
  now?: Date;
}): CategoryDemandNarrationPayload {
  const { primaryYear, historyYearsAsc, shopScopeLabel, blocks } = input;
  const now = input.now ?? new Date();
  const demandWindow = resolveCategoryDemandWindow(now, primaryYear);

  const dateNote = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const yearSet = new Set(historyYearsAsc);

  const categories = blocks.map((b) => {
    const linesNeedingOrder = b.items.filter((r) => r.qtyToOrder > 0).length;
    const totalQtyToOrder = b.items.reduce((s, r) => s + r.qtyToOrder, 0);

    const totalsByYear =
      demandWindow.kind === "fullYear"
        ? b.totalsByYear
        : historyYearsAsc.map((y) => ({
            year: y,
            total: b.items.reduce((s, item) => s + unitsForItemYear(item, y, demandWindow), 0),
          }));

    const withPrimary = b.items
      .map((r) => ({
        name: r.name,
        units: unitsForItemYear(r, primaryYear, demandWindow),
      }))
      .filter((x) => x.units > 0)
      .sort((a, b) => b.units - a.units)
      .slice(0, 3);

    const topLinesAcrossHistory = b.items
      .map((r) => ({
        name: r.name,
        unitsSumHistory: [...yearSet].reduce(
          (s, y) => s + unitsForItemYear(r, y, demandWindow),
          0
        ),
      }))
      .filter((x) => x.unitsSumHistory > 0)
      .sort((a, b) => b.unitsSumHistory - a.unitsSumHistory)
      .slice(0, 3);

    return {
      id: b.id,
      label: b.label,
      description: b.description,
      totalsByYear,
      productLineCount: b.items.length,
      totalCurrentStock: b.totalCurrentStock,
      totalDailyDemand: b.totalDailyDemand,
      totalQtyToOrder,
      linesNeedingOrder,
      demandOnly: b.hideStockRunoutColumns === true,
      topLinesPrimaryYear: withPrimary,
      topLinesAcrossHistory,
    };
  });

  const aggregateUnitsByYear = historyYearsAsc.map((y) => {
    let totalUnits = 0;
    for (const b of blocks) {
      if (demandWindow.kind === "fullYear") {
        const row = b.totalsByYear.find((t) => t.year === y);
        if (row) totalUnits += row.total;
      } else {
        totalUnits += b.items.reduce((s, item) => s + unitsForItemYear(item, y, demandWindow), 0);
      }
    }
    return { year: y, totalUnits };
  });

  return {
    primaryYear,
    historyYearsAsc,
    demandWindow,
    aggregateUnitsByYear,
    shopScopeLabel,
    dateNote,
    categories,
  };
}

const SYSTEM_PROMPT = `You help shop owners understand category demand — how unit sales cluster by product group across years.

The user message is JSON with: primaryYear, historyYearsAsc, demandWindow, aggregateUnitsByYear, shopScopeLabel, dateNote, categories[] (totalsByYear, topLines*, etc.).

demandWindow:
- If kind is "fullYear": totals are full calendar years — compare years fairly as annual totals.
- If kind is "sameMonthsPartial": ALL demand figures (aggregateUnitsByYear, categories[].totalsByYear, top line rankings) already cover ONLY the same calendar months in each year (see demandWindow.note). The primary year is partial. You MUST explain that clearly in the overview (e.g. "January–February only") and MUST NOT describe these numbers as full-year totals or imply a misleading dip because 2026 is incomplete.

STRICT RULES:
- Plain, friendly English. No jargon overload.
- Rephrase ONLY what appears in the JSON. Do NOT invent categories, products, numbers, or trends.
- Cover every year in historyYearsAsc using aggregateUnitsByYear and category totalsByYear — same window for all years per demandWindow.
- You may reference product names only if they appear in that category’s topLinesPrimaryYear or topLinesAcrossHistory.
- If demandOnly is true for a category, do not imply stock/run-out facts for that group.

Output valid JSON only:
{"overview":"string — 4–7 sentences; if sameMonthsPartial, state the month range up front.","standouts":[{"categoryId":"string or null","note":"string"}]}

At most 4 standouts; fewer if the data does not support them.`;

type RawOpenAI = {
  choices?: Array<{ message?: { content?: string } }>;
};

type RawOut = {
  overview?: string;
  standouts?: Array<{ categoryId?: string | null; note?: string }>;
};

function sanitize(
  raw: RawOut,
  validIds: Set<string>
): CategoryDemandNarrationResult | null {
  const overview = typeof raw.overview === "string" ? raw.overview.trim() : "";
  if (!overview) return null;

  const standouts: CategoryDemandNarrationResult["standouts"] = [];
  const arr = Array.isArray(raw.standouts) ? raw.standouts : [];
  for (const item of arr.slice(0, 4)) {
    const note = typeof item?.note === "string" ? item.note.trim() : "";
    if (!note) continue;
    let categoryId: string | null = null;
    if (typeof item?.categoryId === "string" && validIds.has(item.categoryId)) {
      categoryId = item.categoryId;
    }
    standouts.push({ categoryId, note });
  }

  return { overview, standouts };
}

/**
 * Server-only. Uses OPENAI_API_KEY; optional OPENAI_CATEGORY_DEMAND_MODEL (fallback OPENAI_BRIEFING_MODEL, then gpt-4o-mini).
 */
export async function fetchCategoryDemandNarrationOpenAI(
  payload: CategoryDemandNarrationPayload
): Promise<CategoryDemandNarrationResult | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const model =
    process.env.OPENAI_CATEGORY_DEMAND_MODEL?.trim() ||
    process.env.OPENAI_BRIEFING_MODEL?.trim() ||
    "gpt-4o-mini";
  const validIds = new Set(payload.categories.map((c) => c.id));

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
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Category demand facts as JSON. Produce overview and standouts only.\n\n${JSON.stringify(payload)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(28_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(
        "OpenAI category demand narration HTTP error:",
        res.status,
        errText.slice(0, 500)
      );
      return null;
    }

    const data = (await res.json()) as RawOpenAI;
    const content = data.choices?.[0]?.message?.content;
    if (!content?.trim()) return null;

    let parsed: RawOut;
    try {
      parsed = JSON.parse(content) as RawOut;
    } catch {
      console.error("OpenAI category demand: invalid JSON in message content");
      return null;
    }

    return sanitize(parsed, validIds);
  } catch (e) {
    console.error("OpenAI category demand narration failed:", e);
    return null;
  }
}
