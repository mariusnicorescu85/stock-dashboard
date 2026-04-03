/**
 * §4.7 — Patch **Order workflow** after CSV email send; optionally append a **Send log** row.
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

function wfTable(): string | null {
  return process.env.AIRTABLE_ORDER_WORKFLOWS_TABLE?.trim() || null;
}

function fEmailSentAt() {
  return process.env.AIRTABLE_ORDER_FIELD_EMAIL_SENT_AT?.trim() || "Email sent timestamp";
}

function fEmailSendStatus() {
  return process.env.AIRTABLE_ORDER_FIELD_EMAIL_SEND_STATUS?.trim() || "Email sent status";
}

/** Order workflows table — matches `csv/Order workflows-Grid view.csv` (“CSV file”). */
function fCsvAttachmentLink() {
  return (
    process.env.AIRTABLE_ORDER_FIELD_CSV_ATTACHMENT_LINK?.trim() || "CSV file"
  );
}

function fStatus() {
  return process.env.AIRTABLE_ORDER_FIELD_STATUS?.trim() || "Status";
}

function sendLogTable(): string | null {
  return process.env.AIRTABLE_ORDER_SEND_LOG_TABLE?.trim() || null;
}

/** Send log → Order workflows link; matches `csv/Send log-Grid view.csv`. */
function sendLogWorkflowLinkField() {
  return (
    process.env.AIRTABLE_ORDER_SEND_LOG_WORKFLOW_LINK_FIELD?.trim() || "Order workflow"
  );
}

function sendLogFieldRecipient() {
  return process.env.AIRTABLE_ORDER_SEND_LOG_FIELD_RECIPIENT?.trim() || "Recipient";
}

function sendLogFieldSentAt() {
  return process.env.AIRTABLE_ORDER_SEND_LOG_FIELD_SENT_AT?.trim() || "Sent at";
}

function sendLogFieldOrderRef() {
  return process.env.AIRTABLE_ORDER_SEND_LOG_FIELD_ORDER_REF?.trim() || "Order reference";
}

function sendLogFieldFilename() {
  return (
    process.env.AIRTABLE_ORDER_SEND_LOG_FIELD_CSV_FILENAME?.trim() ||
    "File/message reference"
  );
}

function sendLogFieldDeliveryStatus() {
  return (
    process.env.AIRTABLE_ORDER_SEND_LOG_FIELD_DELIVERY_STATUS?.trim() ||
    "Delivery/provider status"
  );
}

function sendLogFieldTitle() {
  return process.env.AIRTABLE_ORDER_SEND_LOG_FIELD_TITLE?.trim() || "Title";
}

function sendLogFieldCsvUrl() {
  return process.env.AIRTABLE_ORDER_SEND_LOG_FIELD_CSV_URL?.trim() || "CSV URL";
}

function statusAfterSend(): string | null {
  return process.env.OPS_ORDER_WORKFLOW_STATUS_AFTER_CSV_SEND?.trim() || null;
}

export function isLikelyWorkflowRecordId(id: string): boolean {
  return /^rec[a-zA-Z0-9]{14,}$/.test(id.trim());
}

export type OrderWorkflowSendLogPayload = {
  workflowId: string;
  /** Defaults to ISO timestamp when omitted. */
  sentAtIso?: string;
  recipientEmail?: string;
  /** Shown in workflow + send log (e.g. Sent, Queued). */
  sendStatus?: string;
  csvFilename?: string;
  csvUrl?: string;
  orderReference?: string;
  deliveryStatus?: string;
};

export type OrderWorkflowSendLogResult =
  | { ok: true; workflowPatched: boolean; sendLogCreated: boolean }
  | { ok: false; error: string };

async function patchWorkflow(
  table: string,
  recordId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const res = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}/${recordId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable PATCH workflow failed (${res.status}): ${text.slice(0, 400)}`);
  }
}

async function createSendLogRow(fields: Record<string, unknown>): Promise<void> {
  const table = sendLogTable()!;
  const res = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ records: [{ fields }] }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable POST send log failed (${res.status}): ${text.slice(0, 400)}`);
  }
}

/**
 * Updates workflow email fields; optionally workflow status + CSV link; optionally creates a Send log record.
 */
export async function applyOrderWorkflowSendLog(
  payload: OrderWorkflowSendLogPayload
): Promise<OrderWorkflowSendLogResult> {
  const table = wfTable();
  if (!AIRTABLE_API_KEY?.trim() || !AIRTABLE_BASE_ID?.trim() || !table) {
    return {
      ok: false,
      error:
        "Missing AIRTABLE_API_KEY, AIRTABLE_BASE_ID, or AIRTABLE_ORDER_WORKFLOWS_TABLE.",
    };
  }

  const id = payload.workflowId.trim();
  if (!isLikelyWorkflowRecordId(id)) {
    return { ok: false, error: "Invalid workflowId — expected an Airtable record id (rec…)." };
  }

  const sentAt = payload.sentAtIso?.trim() || new Date().toISOString();

  const wfFields: Record<string, unknown> = {
    [fEmailSentAt()]: sentAt,
    [fEmailSendStatus()]: (payload.sendStatus?.trim() || "Sent").slice(0, 200),
  };

  if (payload.csvUrl?.trim()) {
    wfFields[fCsvAttachmentLink()] = payload.csvUrl.trim().slice(0, 2000);
  }

  const nextStatus = statusAfterSend();
  if (nextStatus) {
    wfFields[fStatus()] = nextStatus;
  }

  try {
    await patchWorkflow(table, id, wfFields);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }

  let sendLogCreated = false;
  const logTable = sendLogTable();
  if (logTable) {
    const linkField = sendLogWorkflowLinkField();
    const logFields: Record<string, unknown> = {
      [linkField]: [id],
      [sendLogFieldSentAt()]: sentAt,
    };
    if (payload.orderReference?.trim()) {
      logFields[sendLogFieldTitle()] =
        `Send ${payload.orderReference.trim()}`.slice(0, 500);
    }
    if (payload.recipientEmail?.trim()) {
      logFields[sendLogFieldRecipient()] = payload.recipientEmail.trim().slice(0, 500);
    }
    if (payload.orderReference?.trim()) {
      logFields[sendLogFieldOrderRef()] = payload.orderReference.trim().slice(0, 500);
    }
    if (payload.csvFilename?.trim()) {
      logFields[sendLogFieldFilename()] = payload.csvFilename.trim().slice(0, 500);
    }
    if (payload.deliveryStatus?.trim()) {
      logFields[sendLogFieldDeliveryStatus()] = payload.deliveryStatus.trim().slice(0, 500);
    } else if (payload.sendStatus?.trim()) {
      logFields[sendLogFieldDeliveryStatus()] = payload.sendStatus.trim().slice(0, 500);
    }
    if (payload.csvUrl?.trim()) {
      logFields[sendLogFieldCsvUrl()] = payload.csvUrl.trim().slice(0, 2000);
    }

    try {
      await createSendLogRow(logFields);
      sendLogCreated = true;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        error: `Workflow updated but send log failed: ${message}`,
      };
    }
  }

  return { ok: true, workflowPatched: true, sendLogCreated };
}
