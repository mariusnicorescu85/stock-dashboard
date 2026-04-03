/**
 * Read-only list of **Order workflows** for an in-app progress view (no Airtable UI for viewers).
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

export type OrderWorkflowProgressRow = {
  id: string;
  orderReference: string | null;
  status: string | null;
  severity: string | null;
  supplierName: string | null;
  store: string | null;
  currency: string | null;
  lineCount: number | null;
  emailSentAt: string | null;
  emailSendStatus: string | null;
  trackingNumber: string | null;
  expectedDelivery: string | null;
  shipmentStatus: string | null;
  triggerDate: string | null;
  generatedDate: string | null;
  submissionDeadline: string | null;
  owner: string | null;
};

function pickStr(f: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = f[k];
    if (v == null || v === "") continue;
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
  }
  return null;
}

function pickOwner(f: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = f[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.name === "string" && o.name.trim()) return o.name.trim();
      if (typeof o.email === "string" && o.email.trim()) return o.email.trim();
    }
  }
  return null;
}

function linkLength(f: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = f[k];
    if (Array.isArray(v)) return v.length;
  }
  return null;
}

function mapRecord(r: { id: string; fields?: Record<string, unknown> }): OrderWorkflowProgressRow {
  const fields = r.fields ?? {};
  const severityField = process.env.AIRTABLE_ORDER_FIELD_SEVERITY?.trim() || "Severity";
  const deadlineField =
    process.env.AIRTABLE_ORDER_FIELD_SUBMISSION_DEADLINE?.trim() || "Submission deadline";

  return {
    id: r.id,
    orderReference: pickStr(fields, "Order reference"),
    status: pickStr(fields, "Status"),
    severity: pickStr(fields, severityField, "Severity"),
    supplierName: pickStr(fields, "Supplier name"),
    store: pickStr(fields, "Store"),
    currency: pickStr(fields, "Currency"),
    lineCount: linkLength(fields, "Order lines", "Order Lines"),
    emailSentAt: pickStr(fields, "Email sent timestamp", "Email Sent Timestamp"),
    emailSendStatus: pickStr(fields, "Email sent status", "Email Send Status"),
    trackingNumber: pickStr(fields, "Tracking number"),
    expectedDelivery: pickStr(fields, "Expected delivery date", "Expected Delivery Date"),
    shipmentStatus: pickStr(fields, "Shipment status", "Shipment Status"),
    triggerDate: pickStr(fields, "Stock-risk trigger date", "Stock risk trigger date"),
    generatedDate: pickStr(fields, "Generated date", "Generated Date"),
    submissionDeadline: pickStr(fields, deadlineField, "Submission deadline", "Submission Deadline"),
    owner: pickOwner(fields, "Assigned owner", "Assigned Owner"),
  };
}

/** Best-effort “recency” for sorting when Airtable has no API-sortable modified time field. */
function rowRecencyMs(r: OrderWorkflowProgressRow): number {
  const dates = [
    r.emailSentAt,
    r.generatedDate,
    r.triggerDate,
    r.expectedDelivery,
    r.submissionDeadline,
  ];
  let best = 0;
  for (const d of dates) {
    if (!d) continue;
    const t = Date.parse(d);
    if (!Number.isNaN(t)) best = Math.max(best, t);
  }
  if (best > 0) return best;
  const ref = r.orderReference ?? "";
  const m = ref.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) {
    const t = Date.parse(m[1]!);
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

export type FetchOrderWorkflowProgressResult = {
  rows: OrderWorkflowProgressRow[];
  disabledReason: string | null;
  error: string | null;
};

export type FetchOrderWorkflowRawResult =
  | {
      ok: true;
      records: Array<{ id: string; fields: Record<string, unknown> }>;
    }
  | { ok: false; error: string; disabledReason: string | null };

/**
 * Paged fetch of workflow rows (raw Airtable fields) for automation / reminders.
 */
export async function fetchOrderWorkflowRawRecords(
  maxRecords = 500
): Promise<FetchOrderWorkflowRawResult> {
  const table = process.env.AIRTABLE_ORDER_WORKFLOWS_TABLE?.trim();

  if (!table) {
    return {
      ok: false,
      disabledReason:
        "Set AIRTABLE_ORDER_WORKFLOWS_TABLE in the environment to show order progress here.",
      error: "Missing AIRTABLE_ORDER_WORKFLOWS_TABLE",
    };
  }

  if (!AIRTABLE_API_KEY?.trim() || !AIRTABLE_BASE_ID?.trim()) {
    return {
      ok: false,
      disabledReason: null,
      error: "Airtable credentials are not configured.",
    };
  }

  const cap = Math.min(500, Math.max(1, maxRecords));
  const out: Array<{ id: string; fields: Record<string, unknown> }> = [];
  let offset: string | undefined;

  try {
    while (out.length < cap) {
      const url = new URL(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`
      );
      const page = Math.min(100, cap - out.length);
      url.searchParams.set("pageSize", String(page));
      if (offset) url.searchParams.set("offset", offset);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text();
        return {
          ok: false,
          disabledReason: null,
          error: `Airtable error (${res.status}): ${text.slice(0, 300)}`,
        };
      }

      const data = (await res.json()) as {
        records?: Array<{ id: string; fields?: Record<string, unknown> }>;
        offset?: string;
      };

      for (const rec of data.records ?? []) {
        out.push({ id: rec.id, fields: rec.fields ?? {} });
      }

      offset = data.offset;
      if (!offset || !data.records?.length) break;
    }

    return { ok: true, records: out };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, disabledReason: null, error: message };
  }
}

/**
 * Fetches up to {@link maxRecords} workflow rows (paged), then sorts **newest first** in-app using
 * email sent time, generated date, trigger date, ETA, or a date embedded in the order reference.
 * (Airtable’s “Last modified” system field is not always a valid API `sort` field name.)
 */
export async function fetchOrderWorkflowProgressRows(
  maxRecords = 200
): Promise<FetchOrderWorkflowProgressResult> {
  const raw = await fetchOrderWorkflowRawRecords(maxRecords);

  if (!raw.ok) {
    if (raw.disabledReason) {
      return { rows: [], disabledReason: raw.disabledReason, error: null };
    }
    return { rows: [], disabledReason: null, error: raw.error };
  }

  const out = raw.records.map((rec) => mapRecord(rec));
  out.sort((a, b) => rowRecencyMs(b) - rowRecencyMs(a));

  return { rows: out, disabledReason: null, error: null };
}
