/**
 * Build Nuvaleo spec §5 CSV for a single **Order workflow** + linked **Order lines** from Airtable.
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

function wfTable(): string | null {
  return process.env.AIRTABLE_ORDER_WORKFLOWS_TABLE?.trim() || null;
}

function lnTable(): string | null {
  return process.env.AIRTABLE_ORDER_LINES_TABLE?.trim() || null;
}

function fOrderRef() {
  return process.env.AIRTABLE_ORDER_FIELD_ORDER_REF?.trim() || "Order reference";
}
function fSupplierName() {
  return process.env.AIRTABLE_ORDER_FIELD_SUPPLIER_NAME?.trim() || "Supplier name";
}
function fSupplierEmail() {
  return process.env.AIRTABLE_ORDER_FIELD_SUPPLIER_EMAIL?.trim() || "Supplier email";
}
function fStore() {
  return process.env.AIRTABLE_ORDER_FIELD_STORE?.trim() || "Store";
}
function fCurrency() {
  return process.env.AIRTABLE_ORDER_FIELD_CURRENCY?.trim() || "Currency";
}
function fLineLink() {
  return process.env.AIRTABLE_ORDER_LINES_WORKFLOW_LINK_FIELD?.trim() || "Order workflows";
}
function fSku() {
  return process.env.AIRTABLE_ORDER_LINES_SKU_FIELD?.trim() || "SKU/Product code";
}
function fProdName() {
  return process.env.AIRTABLE_ORDER_LINES_NAME_FIELD?.trim() || "Product name";
}
function fQty() {
  return process.env.AIRTABLE_ORDER_LINES_QTY_FIELD?.trim() || "Required quantity";
}
function fUnitCost() {
  return process.env.AIRTABLE_ORDER_LINES_UNIT_COST_FIELD?.trim() || "Unit cost";
}
function fLineTotal() {
  return process.env.AIRTABLE_ORDER_LINES_LINE_TOTAL_FIELD?.trim() || "Line total";
}

/** Inverse link on the **workflow** row: array of linked Order line record ids. */
function fWorkflowOrderLinesInverse() {
  return (
    process.env.AIRTABLE_ORDER_WORKFLOW_ORDER_LINES_FIELD?.trim() || "Order lines"
  );
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function strField(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v == null || v === "") continue;
    if (typeof v === "string") return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
}

function numField(row: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (v == null || v === "") continue;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const t = v.replace(/[€$£\s,]/g, "").replace(",", ".");
      const n = Number(t);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

/** §5 minimum columns (header row). */
export const ORDER_WORKFLOW_CSV_HEADERS = [
  "Supplier name",
  "Supplier email",
  "SKU / product code",
  "Product name",
  "Required quantity",
  "Unit cost",
  "Line total",
  "Order total",
  "Currency",
  "Store / location",
  "Order reference",
  "Generated date",
] as const;

export type OrderWorkflowCsvOk = {
  ok: true;
  workflowRecordId: string;
  orderReference: string;
  supplierName: string;
  supplierEmail: string;
  store: string;
  currency: string;
  filename: string;
  csv: string;
  lineCount: number;
  orderTotal: number;
  generatedAtIso: string;
};

export type OrderWorkflowCsvErr = { ok: false; error: string };

export type OrderWorkflowCsvResult = OrderWorkflowCsvOk | OrderWorkflowCsvErr;

function sanitizeFilename(s: string): string {
  return s.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "order";
}

export function isLikelyAirtableRecordId(id: string): boolean {
  return /^rec[a-zA-Z0-9]{14,}$/.test(id.trim());
}

function extractLinkedRecordIds(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.filter(
      (v): v is string => typeof v === "string" && /^rec[a-zA-Z0-9]{14,}$/.test(v)
    );
  }
  if (typeof value === "string" && /^rec[a-zA-Z0-9]{14,}$/.test(value)) {
    return [value];
  }
  return [];
}

async function airtableGetRecord(table: string, recordId: string) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    table
  )}/${recordId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Workflow fetch failed (${res.status}): ${text.slice(0, 400)}`);
  }
  return (await res.json()) as { fields?: Record<string, unknown> };
}

async function fetchOrderLineRecordsByIds(
  lineIds: string[]
): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const table = lnTable()!;
  const out: Array<{ id: string; fields: Record<string, unknown> }> = [];

  for (const lineId of lineIds) {
    try {
      const r = await airtableGetRecord(table, lineId);
      out.push({ id: lineId, fields: r.fields ?? {} });
    } catch {
      /* stale link */
    }
    await sleep(75);
  }

  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fallback: list lines where the link field points at this workflow (Airtable behavior varies by base). */
async function fetchOrderLinesForWorkflowByLinkFilter(
  workflowRecordId: string
): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const table = lnTable()!;
  const linkField = fLineLink();
  const rid = workflowRecordId.replace(/'/g, "\\'");
  const formula = `{${linkField}}='${rid}'`;

  const out: Array<{ id: string; fields: Record<string, unknown> }> = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`
    );
    url.searchParams.set("filterByFormula", formula);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Order lines list failed (${res.status}): ${text.slice(0, 400)}`);
    }

    const data = (await res.json()) as {
      records?: Array<{ id: string; fields: Record<string, unknown> }>;
      offset?: string;
    };

    for (const r of data.records ?? []) {
      out.push({ id: r.id, fields: r.fields ?? {} });
    }
    offset = data.offset;
  } while (offset);

  return out;
}

async function fetchOrderLinesForWorkflow(
  workflowRecordId: string,
  workflowFields: Record<string, unknown>
): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const inverseField = fWorkflowOrderLinesInverse();
  const fromInverse = extractLinkedRecordIds(workflowFields[inverseField]);

  if (fromInverse.length > 0) {
    return fetchOrderLineRecordsByIds(fromInverse);
  }

  return fetchOrderLinesForWorkflowByLinkFilter(workflowRecordId);
}

function lineComputedTotal(fields: Record<string, unknown>): number {
  const lt = numField(fields, fLineTotal(), "Line total");
  if (lt > 0) return Math.round(lt * 100) / 100;
  const q = numField(fields, fQty(), "Required quantity");
  const u = numField(fields, fUnitCost(), "Unit cost");
  return Math.round(q * u * 100) / 100;
}

/**
 * Load workflow + lines from Airtable and render CSV (§5 columns).
 */
export async function buildOrderWorkflowCsvForRecord(
  workflowRecordId: string
): Promise<OrderWorkflowCsvResult> {
  const wft = wfTable();
  const lnt = lnTable();

  if (
    !AIRTABLE_API_KEY?.trim() ||
    !AIRTABLE_BASE_ID?.trim() ||
    !wft ||
    !lnt
  ) {
    const missing: string[] = [];
    if (!AIRTABLE_API_KEY?.trim()) missing.push("AIRTABLE_API_KEY");
    if (!AIRTABLE_BASE_ID?.trim()) missing.push("AIRTABLE_BASE_ID");
    if (!wft) missing.push("AIRTABLE_ORDER_WORKFLOWS_TABLE");
    if (!lnt) missing.push("AIRTABLE_ORDER_LINES_TABLE");
    return {
      ok: false,
      error: `Server env not configured for order CSV: ${missing.join(", ")}. Add them in Vercel → Settings → Environment Variables and redeploy.`,
    };
  }

  const workflowsTable = wft;

  const id = workflowRecordId.trim();
  if (!isLikelyAirtableRecordId(id)) {
    return { ok: false, error: "Invalid workflowRecordId — expected an Airtable record id (rec…)." };
  }

  try {
    const { fields: wf } = await airtableGetRecord(workflowsTable, id);
    if (!wf) {
      return { ok: false, error: "Workflow record not found or empty." };
    }

    const orderReference = strField(wf, fOrderRef(), "Order reference");
    if (!orderReference) {
      return { ok: false, error: "Workflow has no Order reference — cannot build CSV." };
    }

    const supplierName = strField(wf, fSupplierName(), "Supplier name");
    const supplierEmail = strField(wf, fSupplierEmail(), "Supplier email");
    const store = strField(wf, fStore(), "Store");
    const currency = strField(wf, fCurrency(), "Currency");

    const lineRows = await fetchOrderLinesForWorkflow(id, wf);
    if (lineRows.length === 0) {
      return {
        ok: false,
        error:
          "No order lines linked to this workflow. In Airtable, check the line rows link to this workflow " +
          `(field “${fLineLink()}”) and/or that the workflow has linked lines in “${fWorkflowOrderLinesInverse()}”. ` +
          `If your link field names differ, set env AIRTABLE_ORDER_LINES_WORKFLOW_LINK_FIELD and/or AIRTABLE_ORDER_WORKFLOW_ORDER_LINES_FIELD.`,
      };
    }

    const generatedAtIso = new Date().toISOString();

    const bodyRows: string[][] = [];
    let orderTotal = 0;

    for (const { fields } of lineRows) {
      const sku = strField(fields, fSku(), "SKU/Product code");
      const productName = strField(fields, fProdName(), "Product name");
      const qty = Math.max(0, Math.floor(numField(fields, fQty(), "Required quantity")));
      const unitCost = numField(fields, fUnitCost(), "Unit cost");
      let lineTotal = numField(fields, fLineTotal(), "Line total");
      if (lineTotal <= 0 && qty > 0 && unitCost > 0) {
        lineTotal = Math.round(qty * unitCost * 100) / 100;
      }
      orderTotal += lineTotal;

      bodyRows.push([
        supplierName,
        supplierEmail,
        sku,
        productName,
        String(qty),
        unitCost > 0 ? String(unitCost) : "",
        lineTotal > 0 ? String(lineTotal) : "",
        "", // order total lives on the final **ORDER TOTAL** row only
        currency,
        store,
        orderReference,
        generatedAtIso,
      ]);
    }

    orderTotal = Math.round(orderTotal * 100) / 100;
    const orderTotalStr = String(orderTotal);

    const totalsRow: string[] = [
      "",
      "",
      "",
      "ORDER TOTAL",
      "",
      "",
      "",
      orderTotalStr,
      currency,
      store,
      orderReference,
      "",
    ];

    const lines: string[] = [
      ORDER_WORKFLOW_CSV_HEADERS.map(csvEscape).join(","),
      ...bodyRows.map((cells) => cells.map(csvEscape).join(",")),
      totalsRow.map(csvEscape).join(","),
    ];
    const csv = lines.join("\r\n");

    const filename = `${sanitizeFilename(orderReference)}-${generatedAtIso.slice(0, 10)}.csv`;

    return {
      ok: true,
      workflowRecordId: id,
      orderReference,
      supplierName,
      supplierEmail,
      store,
      currency,
      filename,
      csv,
      lineCount: lineRows.length,
      orderTotal,
      generatedAtIso,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}
