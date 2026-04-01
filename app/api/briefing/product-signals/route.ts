import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/app/api/cron/_shared";
import { dateToYmd } from "@/lib/calendar";

export const dynamic = "force-dynamic";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_PRODUCTS_TABLE = process.env.AIRTABLE_PRODUCTS_TABLE || "Products";
const AIRTABLE_PYT_PRODUCTS_TABLE = process.env.AIRTABLE_PYT_PRODUCTS_TABLE || "PYT Products";

const FIELD_SNOOZE = "Briefing snooze until";
const FIELD_ORDERED = "Briefing ordered at";

function allowedProductTables(): Set<string> {
  return new Set([AIRTABLE_PRODUCTS_TABLE, AIRTABLE_PYT_PRODUCTS_TABLE]);
}

function addDaysYmd(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dateToYmd(d);
}

type Action =
  | "snooze3"
  | "snooze7"
  | "snooze14"
  | "clearSnooze"
  | "markOrdered"
  | "clearOrdered";

/**
 * POST — Authorization: Bearer CRON_SECRET
 * Body: { recordId, sourceTable, action }
 */
export async function POST(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { recordId?: string; sourceTable?: string; action?: Action };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const recordId = body.recordId?.trim();
  const sourceTable = body.sourceTable?.trim();
  const action = body.action;

  if (!recordId || !sourceTable || !action) {
    return NextResponse.json(
      { error: "Missing recordId, sourceTable, or action" },
      { status: 400 }
    );
  }

  if (!allowedProductTables().has(sourceTable)) {
    return NextResponse.json({ error: "Invalid sourceTable" }, { status: 400 });
  }

  const validActions: Action[] = [
    "snooze3",
    "snooze7",
    "snooze14",
    "clearSnooze",
    "markOrdered",
    "clearOrdered",
  ];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const fields: Record<string, string | null> = {};

  switch (action) {
    case "snooze3":
      fields[FIELD_SNOOZE] = addDaysYmd(3);
      break;
    case "snooze7":
      fields[FIELD_SNOOZE] = addDaysYmd(7);
      break;
    case "snooze14":
      fields[FIELD_SNOOZE] = addDaysYmd(14);
      break;
    case "clearSnooze":
      fields[FIELD_SNOOZE] = null;
      break;
    case "markOrdered":
      fields[FIELD_ORDERED] = dateToYmd(new Date());
      break;
    case "clearOrdered":
      fields[FIELD_ORDERED] = null;
      break;
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (!AIRTABLE_API_KEY?.trim() || !AIRTABLE_BASE_ID?.trim()) {
    return NextResponse.json({ error: "Airtable not configured" }, { status: 500 });
  }

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    sourceTable
  )}/${recordId}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("product-signals PATCH failed:", res.status, errText.slice(0, 500));
    return NextResponse.json(
      { error: "Airtable PATCH failed", detail: errText.slice(0, 300) },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, action, fields });
}
