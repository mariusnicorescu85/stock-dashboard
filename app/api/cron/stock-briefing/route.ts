import { NextResponse } from "next/server";
import {
  authorizeCronRequest,
  loadStockDigestEmail,
} from "@/app/api/cron/_shared";
import { upsertBriefingBaselineFromBriefing } from "@/lib/briefingBaselineAirtable";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * JSON digest for n8n (or similar): use HTTP Request + Gmail node.
 * GET with Authorization: Bearer CRON_SECRET
 *
 * Query: full=1 — include full `briefing` object (larger payload).
 *
 * Env: CRON_SECRET, Airtable vars.
 */
export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const full = searchParams.get("full") === "1";

  const digest = await loadStockDigestEmail();
  const { briefing, ...rest } = digest;

  const baselineUpsert = await upsertBriefingBaselineFromBriefing(briefing);

  const body: Record<string, unknown> = {
    ok: true,
    baselineSnapshot: {
      saved: baselineUpsert.saved,
      ...(baselineUpsert.message ? { message: baselineUpsert.message } : {}),
    },
    dateLabel: briefing.dateLabel,
    todayYmd: briefing.todayYmd,
    dashboardUrl: rest.dashboardUrl,
    subject: rest.subject,
    text: rest.text,
    html: rest.html,
    summary: {
      reorderSkuCount: briefing.reorderSkuCount,
      totalUnitsToOrder: briefing.totalUnitsToOrder,
      critical0to7: briefing.critical0to7,
      urgent8to14: briefing.urgent8to14,
      reorderQueueHasOverdueOrderBy: briefing.reorderQueueHasOverdueOrderBy,
      soonestFutureOrderByIso: briefing.soonestFutureOrderByIso,
    },
  };

  if (full) {
    body.briefing = briefing;
  }

  return NextResponse.json(body);
}
