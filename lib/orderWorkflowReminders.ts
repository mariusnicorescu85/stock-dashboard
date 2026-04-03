/**
 * PDF §4.8–12 / §8-style reminder candidates for n8n (no emails sent from Next.js).
 * Uses the same Order workflows field names as your Airtable exports.
 */

import { fetchOrderWorkflowRawRecords } from "./orderWorkflowProgress";

function closedLabel(): string {
  return process.env.OPS_ORDER_WORKFLOW_STATUS_CLOSED?.trim() || "Closed";
}

function t1MinHours(): number {
  const raw = process.env.OPS_REMINDER_T1_MIN_HOURS_AFTER_EMAIL?.trim();
  const n = raw ? Number.parseFloat(raw) : 24;
  return Number.isFinite(n) && n > 0 ? n : 24;
}

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
      if (typeof o.email === "string" && o.email.trim()) return o.email.trim();
      if (typeof o.name === "string" && o.name.trim()) return o.name.trim();
    }
  }
  return null;
}

function isClosedStatus(status: string | null): boolean {
  if (!status?.trim()) return false;
  const closed = closedLabel();
  if (status === closed) return true;
  return status.toLowerCase().includes("closed");
}

function hoursSince(isoOrDisplay: string | null): number | null {
  if (!isoOrDisplay?.trim()) return null;
  const t = Date.parse(isoOrDisplay);
  if (!Number.isNaN(t)) return (Date.now() - t) / 3_600_000;
  const d = new Date(isoOrDisplay);
  if (!Number.isNaN(d.getTime())) return (Date.now() - d.getTime()) / 3_600_000;
  return null;
}

function isTruthyCheckbox(f: Record<string, unknown>, field: string): boolean {
  const v = f[field];
  if (v === true) return true;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "yes" || s === "true" || s === "checked";
  }
  return false;
}

function finalUploadDone(f: Record<string, unknown>): boolean {
  return isTruthyCheckbox(f, "Final order uploaded");
}

function trackingPresent(f: Record<string, unknown>): boolean {
  const t = pickStr(f, "Tracking number");
  return Boolean(t?.trim());
}

function goodsReceivedDone(f: Record<string, unknown>): boolean {
  const field = process.env.AIRTABLE_ORDER_FIELD_GOODS_RECEIVED_PROOF?.trim() || "Goods received proof";
  const v = f[field] ?? f["Goods received proof"];
  if (v === true) return true;
  if (typeof v === "string" && v.trim()) return true;
  if (Array.isArray(v) && v.length > 0) return true;
  return false;
}

function submissionDeadlinePassed(f: Record<string, unknown>): boolean {
  const field =
    process.env.AIRTABLE_ORDER_FIELD_SUBMISSION_DEADLINE?.trim() || "Submission deadline";
  const ymd = pickStr(f, field, "Submission deadline", "Submission Deadline");
  if (!ymd) return false;
  const t = Date.parse(ymd);
  if (Number.isNaN(t)) return false;
  const end = new Date(t);
  end.setHours(23, 59, 59, 999);
  return Date.now() > end.getTime();
}

export type OrderWorkflowReminderItem = {
  workflowRecordId: string;
  orderReference: string | null;
  status: string | null;
  supplierName: string | null;
  supplierEmail: string | null;
  owner: string | null;
  reason: string;
};

function toItem(
  id: string,
  fields: Record<string, unknown>,
  reason: string
): OrderWorkflowReminderItem {
  return {
    workflowRecordId: id,
    orderReference: pickStr(fields, "Order reference"),
    status: pickStr(fields, "Status"),
    supplierName: pickStr(fields, "Supplier name"),
    supplierEmail: pickStr(fields, "Supplier email"),
    owner: pickOwner(fields, "Assigned owner", "Assigned Owner"),
    reason,
  };
}

export type OrderWorkflowRemindersResult =
  | {
      ok: true;
      generatedAtIso: string;
      /** §4.11–12: email sent, no tracking, past min hours, not closed */
      t1NoTracking: OrderWorkflowReminderItem[];
      /** §4.8–10: CSV/email path done, final supplier order not uploaded */
      awaitingFinalOrderUpload: OrderWorkflowReminderItem[];
      /** Submission deadline date passed, not closed, final upload not done */
      submissionDeadlineOverdue: OrderWorkflowReminderItem[];
      /** Delay flag set — surface for escalation n8n branch */
      delayFlagged: OrderWorkflowReminderItem[];
      /** §4.15–16 helper: closed status but no goods received proof (policy breach to investigate) */
      closedWithoutGoodsProof: OrderWorkflowReminderItem[];
    }
  | { ok: false; error: string };

/**
 * Scans workflows (up to 500 records) and returns reminder buckets for n8n.
 */
export async function computeOrderWorkflowReminders(): Promise<OrderWorkflowRemindersResult> {
  const raw = await fetchOrderWorkflowRawRecords(500);
  if (!raw.ok) {
    return { ok: false, error: raw.disabledReason ?? raw.error };
  }

  const t1NoTracking: OrderWorkflowReminderItem[] = [];
  const awaitingFinalOrderUpload: OrderWorkflowReminderItem[] = [];
  const submissionDeadlineOverdue: OrderWorkflowReminderItem[] = [];
  const delayFlagged: OrderWorkflowReminderItem[] = [];
  const closedWithoutGoodsProof: OrderWorkflowReminderItem[] = [];

  const minH = t1MinHours();

  for (const { id, fields } of raw.records) {
    const status = pickStr(fields, "Status");
    if (isClosedStatus(status)) {
      if (!goodsReceivedDone(fields)) {
        closedWithoutGoodsProof.push(
          toItem(id, fields, "Closed but goods received proof missing — review policy (§4.15–16)")
        );
      }
      continue;
    }

    const emailSent = pickStr(fields, "Email sent timestamp", "Email Sent Timestamp");
    const h = hoursSince(emailSent);

    if (emailSent && h != null && h >= minH && !trackingPresent(fields)) {
      t1NoTracking.push(
        toItem(
          id,
          fields,
          `No tracking ≥${minH}h after email sent (§4.11–12)`
        )
      );
    }

    if (emailSent && !finalUploadDone(fields)) {
      awaitingFinalOrderUpload.push(
        toItem(id, fields, "Final order not uploaded after CSV/email path (§4.8–10)")
      );
    }

    if (submissionDeadlinePassed(fields) && !finalUploadDone(fields)) {
      submissionDeadlineOverdue.push(
        toItem(id, fields, "Submission deadline passed without final order upload")
      );
    }

    if (isTruthyCheckbox(fields, "Delay flag")) {
      delayFlagged.push(
        toItem(id, fields, "Delay flag set — escalate per §8 / internal policy")
      );
    }
  }

  return {
    ok: true,
    generatedAtIso: new Date().toISOString(),
    t1NoTracking,
    awaitingFinalOrderUpload,
    submissionDeadlineOverdue,
    delayFlagged,
    closedWithoutGoodsProof,
  };
}
