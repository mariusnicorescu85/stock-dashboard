import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/app/api/cron/_shared";
import { syncOrderWorkflowsFromProducts } from "@/lib/orderWorkflowAirtable";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Creates **Order workflows** + **Order lines** in Airtable from current reorder logic (`needingOrder`),
 * grouped by supplier + store + currency. Idempotent per **Dedupe key** while status ≠ Closed.
 *
 * - GET or POST
 * - Header: `Authorization: Bearer CRON_SECRET`
 * - Query: `dryRun=1` — report what would be created without writing
 *
 * Env: `AIRTABLE_ORDER_WORKFLOWS_TABLE`, `AIRTABLE_ORDER_LINES_TABLE` (and standard Airtable vars).
 * Optional: `OPS_ORDER_WORKFLOW_STATUS_DRAFT`, `OPS_ORDER_WORKFLOW_STATUS_CLOSED`, field name overrides `AIRTABLE_ORDER_FIELD_*`, etc. — see `lib/orderWorkflowAirtable.ts`.
 */
export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dryRun") === "1" || searchParams.get("dry") === "1";

  const result = await syncOrderWorkflowsFromProducts({ dryRun });

  if (result.disabled) {
    return NextResponse.json({
      ok: true,
      disabled: true,
      message: result.message,
      created: [],
      skipped: [],
    });
  }

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        created: result.created,
        skipped: result.skipped,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    dryRun: result.dryRun ?? dryRun,
    created: result.created,
    skipped: result.skipped,
  });
}
