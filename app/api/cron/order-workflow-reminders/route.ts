import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/app/api/cron/_shared";
import { computeOrderWorkflowReminders } from "@/lib/orderWorkflowReminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * PDF §4.8–12 / §8 — Returns **reminder candidate lists** for n8n (no emails from this route).
 *
 * - GET or POST, header `Authorization: Bearer CRON_SECRET`
 * - Query `types` (optional): comma list to include only some buckets:
 *   `t1NoTracking`, `awaitingFinalOrderUpload`, `submissionDeadlineOverdue`, `delayFlagged`, `closedWithoutGoodsProof`
 *   Omit to return all.
 *
 * Env: `OPS_REMINDER_T1_MIN_HOURS_AFTER_EMAIL` (default 24), `OPS_ORDER_WORKFLOW_STATUS_CLOSED`, etc.
 */
export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

function parseTypes(url: URL): Set<string> | null {
  const raw = url.searchParams.get("types")?.trim();
  if (!raw) return null;
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

type Buckets = {
  t1NoTracking: unknown[];
  awaitingFinalOrderUpload: unknown[];
  submissionDeadlineOverdue: unknown[];
  delayFlagged: unknown[];
  closedWithoutGoodsProof: unknown[];
};

function filterBuckets(data: Buckets, types: Set<string> | null): Buckets {
  if (!types || types.size === 0) return data;
  return {
    t1NoTracking: types.has("t1NoTracking") ? data.t1NoTracking : [],
    awaitingFinalOrderUpload: types.has("awaitingFinalOrderUpload")
      ? data.awaitingFinalOrderUpload
      : [],
    submissionDeadlineOverdue: types.has("submissionDeadlineOverdue")
      ? data.submissionDeadlineOverdue
      : [],
    delayFlagged: types.has("delayFlagged") ? data.delayFlagged : [],
    closedWithoutGoodsProof: types.has("closedWithoutGoodsProof")
      ? data.closedWithoutGoodsProof
      : [],
  };
}

async function handle(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await computeOrderWorkflowReminders();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  const types = parseTypes(new URL(req.url));
  const bucketData: Buckets = {
    t1NoTracking: result.t1NoTracking,
    awaitingFinalOrderUpload: result.awaitingFinalOrderUpload,
    submissionDeadlineOverdue: result.submissionDeadlineOverdue,
    delayFlagged: result.delayFlagged,
    closedWithoutGoodsProof: result.closedWithoutGoodsProof,
  };
  const filtered = filterBuckets(bucketData, types);

  const counts = {
    t1NoTracking: filtered.t1NoTracking.length,
    awaitingFinalOrderUpload: filtered.awaitingFinalOrderUpload.length,
    submissionDeadlineOverdue: filtered.submissionDeadlineOverdue.length,
    delayFlagged: filtered.delayFlagged.length,
    closedWithoutGoodsProof: filtered.closedWithoutGoodsProof.length,
  };

  return NextResponse.json({
    ok: true,
    generatedAtIso: result.generatedAtIso,
    counts,
    ...filtered,
  });
}
