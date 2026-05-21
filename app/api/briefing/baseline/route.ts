import { NextResponse } from "next/server";
import { requireClerkUserId } from "@/lib/clerkAuth";
import { upsertBriefingBaselineFromBriefing } from "@/lib/briefingBaselineAirtable";
import { fetchProducts } from "@/lib/airtable";
import {
  buildStockBriefingFromBuckets,
  partitionRunoutBuckets,
} from "@/lib/stockBriefing";

export const dynamic = "force-dynamic";

/**
 * POST — requires signed-in Clerk user. Saves headline briefing metrics to the Airtable baseline row.
 */
export async function POST() {
  const authUser = await requireClerkUserId();
  if (authUser instanceof NextResponse) {
    return authUser;
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
