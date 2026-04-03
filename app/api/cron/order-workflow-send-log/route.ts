import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/app/api/cron/_shared";
import {
  applyOrderWorkflowSendLog,
  type OrderWorkflowSendLogPayload,
} from "@/lib/orderWorkflowSendLog";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * §4.7 — After n8n sends supplier CSV email, call this to stamp the workflow (and optional Send log table).
 *
 * - POST JSON body (or GET query params for quick tests).
 * - Header: `Authorization: Bearer CRON_SECRET`
 *
 * Body/query:
 * - `workflowId` (required) — Airtable Order workflow record id
 * - `sentAtIso` (optional)
 * - `recipientEmail`, `sendStatus`, `csvFilename`, `csvUrl`, `orderReference`, `deliveryStatus` (optional)
 *
 * Env:
 * - Workflow fields: `AIRTABLE_ORDER_FIELD_EMAIL_SENT_AT`, `AIRTABLE_ORDER_FIELD_EMAIL_SEND_STATUS`,
 *   `AIRTABLE_ORDER_FIELD_CSV_ATTACHMENT_LINK` (default field name **CSV file**), `AIRTABLE_ORDER_FIELD_STATUS`
 * - After-send status: `OPS_ORDER_WORKFLOW_STATUS_AFTER_CSV_SEND` (e.g. `CSV sent`)
 * - Optional Send log table: `AIRTABLE_ORDER_SEND_LOG_TABLE` + link field
 *   `AIRTABLE_ORDER_SEND_LOG_WORKFLOW_LINK_FIELD` (default `Order workflow`)
 * - Send log field overrides: `AIRTABLE_ORDER_SEND_LOG_FIELD_TITLE` (default `Title`),
 *   `…_CSV_FILENAME` (default `File/message reference`), `…_DELIVERY_STATUS` (default `Delivery/provider status`)
 */
export async function POST(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Expected JSON object" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const workflowId = typeof o.workflowId === "string" ? o.workflowId : "";
  if (!workflowId.trim()) {
    return NextResponse.json(
      { ok: false, error: 'Missing "workflowId" in JSON body.' },
      { status: 400 }
    );
  }

  const payload: OrderWorkflowSendLogPayload = {
    workflowId,
    sentAtIso: typeof o.sentAtIso === "string" ? o.sentAtIso : undefined,
    recipientEmail: typeof o.recipientEmail === "string" ? o.recipientEmail : undefined,
    sendStatus: typeof o.sendStatus === "string" ? o.sendStatus : undefined,
    csvFilename: typeof o.csvFilename === "string" ? o.csvFilename : undefined,
    csvUrl: typeof o.csvUrl === "string" ? o.csvUrl : undefined,
    orderReference: typeof o.orderReference === "string" ? o.orderReference : undefined,
    deliveryStatus: typeof o.deliveryStatus === "string" ? o.deliveryStatus : undefined,
  };

  const result = await applyOrderWorkflowSendLog(payload);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    workflowPatched: result.workflowPatched,
    sendLogCreated: result.sendLogCreated,
  });
}

export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workflowId = searchParams.get("workflowId")?.trim() ?? "";
  if (!workflowId) {
    return NextResponse.json(
      { ok: false, error: 'Missing query param "workflowId".' },
      { status: 400 }
    );
  }

  const payload: OrderWorkflowSendLogPayload = {
    workflowId,
    sentAtIso: searchParams.get("sentAtIso") ?? undefined,
    recipientEmail: searchParams.get("recipientEmail") ?? undefined,
    sendStatus: searchParams.get("sendStatus") ?? undefined,
    csvFilename: searchParams.get("csvFilename") ?? undefined,
    csvUrl: searchParams.get("csvUrl") ?? undefined,
    orderReference: searchParams.get("orderReference") ?? undefined,
    deliveryStatus: searchParams.get("deliveryStatus") ?? undefined,
  };

  const result = await applyOrderWorkflowSendLog(payload);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    workflowPatched: result.workflowPatched,
    sendLogCreated: result.sendLogCreated,
  });
}
