import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/app/api/cron/_shared";
import { buildOrderWorkflowCsvForRecord } from "@/lib/orderWorkflowExport";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Returns a Nuvaleo spec §5 CSV for one **Order workflow** Airtable record (linked lines loaded automatically).
 *
 * - GET `?workflowId=recXXXXXXXX` — required.
 * - Header: `Authorization: Bearer CRON_SECRET`
 * - Default response: JSON `{ ok, csv, filename, orderReference, supplierEmail, ... }` for n8n.
 * - `?format=csv` — raw `text/csv` with `Content-Disposition: attachment`.
 */
export async function GET(req: Request) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workflowId = searchParams.get("workflowId")?.trim() ?? "";
  const asFile = searchParams.get("format") === "csv";

  if (!workflowId) {
    return NextResponse.json(
      { ok: false, error: 'Missing query param "workflowId" (Airtable record id).' },
      { status: 400 }
    );
  }

  const result = await buildOrderWorkflowCsvForRecord(workflowId);

  if (!result.ok) {
    const status =
      result.error.includes("not found") || result.error.includes("No order lines")
        ? 404
        : result.error.includes("Invalid workflowRecordId")
          ? 400
          : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  if (asFile) {
    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    workflowRecordId: result.workflowRecordId,
    orderReference: result.orderReference,
    supplierName: result.supplierName,
    supplierEmail: result.supplierEmail,
    store: result.store,
    currency: result.currency,
    filename: result.filename,
    csv: result.csv,
    lineCount: result.lineCount,
    orderTotal: result.orderTotal,
    generatedAtIso: result.generatedAtIso,
  });
}
