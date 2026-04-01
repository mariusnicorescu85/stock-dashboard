import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/app/api/cron/_shared";
import { upsertBriefingBaselineFromBriefing } from "@/lib/briefingBaselineAirtable";
import { fetchProducts } from "@/lib/airtable";
import {
  buildStockBriefingFromBuckets,
  partitionRunoutBuckets,
} from "@/lib/stockBriefing";

export const dynamic = "force-dynamic";

/**
 * POST — same auth as GET /api/cron/stock-briefing.
 * Saves headline briefing metrics to the Airtable baseline row (manual / dashboard).
 */
export async function POST(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const products = await fetchProducts();
  const briefing = buildStockBriefingFromBuckets(partitionRunoutBuckets(products));
  const result = await upsertBriefingBaselineFromBriefing(briefing);

  return NextResponse.json({
    ok: true,
    baselineSnapshot: {
      saved: result.saved,
      ...(result.message ? { message: result.message } : {}),
    },
    todayYmd: briefing.todayYmd,
    summary: {
      critical0to7: briefing.critical0to7,
      urgent8to14: briefing.urgent8to14,
      watch15to30: briefing.watch15to30,
      reorderSkuCount: briefing.reorderSkuCount,
    },
  });
}
