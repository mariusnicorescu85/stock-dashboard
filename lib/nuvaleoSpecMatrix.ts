export type NuvaleoSpecStatus = "Done" | "Partial" | "To configure" | "Not started";

export type NuvaleoSpecMatrixRow = {
  pdfRef: string;
  requirement: string;
  status: NuvaleoSpecStatus;
  implementedWhere: string;
  notes?: string;
};

export const NUVALEO_SPEC_MATRIX: NuvaleoSpecMatrixRow[] = [
  {
    pdfRef: "§4.1",
    requirement: "Detect stock risk / stockout within lead time",
    status: "Done",
    implementedWhere: "Stock dashboard reorder logic (needingOrder + runway)",
  },
  {
    pdfRef: "§4.2",
    requirement: "Interpret severity",
    status: "Done",
    implementedWhere:
      "sync-order-workflows writes **Severity** (Critical/High/Medium) from worst runway in the group; `OPS_ORDER_DISABLE_SEVERITY=1` to skip",
    notes: "Add a **Severity** single select in Order workflows with those exact options. Override field name via `AIRTABLE_ORDER_FIELD_SEVERITY`.",
  },
  {
    pdfRef: "§4.3",
    requirement: "Create reorder action + named owner",
    status: "Partial",
    implementedWhere:
      "sync sets **Assigned owner** from `OPS_ORDER_DEFAULT_OWNER_EMAIL` (field defaults to Assigned owner)",
    notes: "Text/email only, not Collaborator. Leave env unset to skip owner on create.",
  },
  {
    pdfRef: "§4.4",
    requirement: "Build order for supplier + store",
    status: "Done",
    implementedWhere: "sync-order-workflows creates grouped workflow + linked lines",
  },
  {
    pdfRef: "§4.5",
    requirement: "Generate supplier CSV",
    status: "Done",
    implementedWhere: "GET /api/cron/order-workflow-csv (JSON default; ?format=csv for file)",
  },
  {
    pdfRef: "§4.6",
    requirement: "Send CSV automatically",
    status: "Partial",
    implementedWhere: "n8n/stock-order-fetch-csv.json (GET CSV + optional POST send log) + Gmail node between Code and POST",
    notes: "Add Airtable/Webhook trigger for production; Vercel cron only runs sync, not per-order email.",
  },
  {
    pdfRef: "§4.7",
    requirement: "Log send (recipient, time, ref, file ref, delivery status)",
    status: "Partial",
    implementedWhere:
      "POST/GET /api/cron/order-workflow-send-log (patches workflow; optional AIRTABLE_ORDER_SEND_LOG_TABLE)",
    notes: "Wire POST after Gmail in n8n so status reflects actual send; align Airtable field names via env.",
  },
  {
    pdfRef: "§4.8–§4.10",
    requirement: "Final order upload required; block progression; reminders/escalate",
    status: "Partial",
    implementedWhere:
      "GET /api/cron/order-workflow-reminders → **awaitingFinalOrderUpload** / **submissionDeadlineOverdue** + `n8n/nuvaleo-daily-reminders.json`; block progression in **Airtable** Interfaces/permissions",
    notes: "Playbook: `docs/nuvaleo-full-automation.md` §2.",
  },
  {
    pdfRef: "§4.11–§4.12",
    requirement: "T+1 check; follow-up if no tracking",
    status: "Partial",
    implementedWhere:
      "Same API → **t1NoTracking** (`OPS_REMINDER_T1_MIN_HOURS_AFTER_EMAIL`, default 24h) + n8n daily Gmail/Slack",
    notes: "Wire n8n after Expand node; see `n8n/nuvaleo-daily-reminders.json`.",
  },
  {
    pdfRef: "§4.13–§4.14",
    requirement: "Store tracking / ETA / status; monitor / delayed",
    status: "Partial",
    implementedWhere: "/ops/orders reads tracking/ETA/shipment fields if present in Airtable",
    notes: "Alerting/monitoring is typically Airtable views + n8n; not app logic.",
  },
  {
    pdfRef: "§4.15–§4.16",
    requirement: "Goods received proof; close only with proof + audit",
    status: "Partial",
    implementedWhere:
      "API → **closedWithoutGoodsProof** (audit list) + Airtable automation on **Closed** without proof (revert/notify) + **Audit events**",
    notes: "Enforcement stays in Airtable; see `docs/nuvaleo-full-automation.md` §2.3.",
  },
  {
    pdfRef: "§5",
    requirement: "Mandatory CSV headers + ORDER TOTAL row",
    status: "Done",
    implementedWhere: "lib/orderWorkflowExport.ts + GET /api/cron/order-workflow-csv",
  },
  {
    pdfRef: "§6",
    requirement: "Statuses",
    status: "Partial",
    implementedWhere:
      "Airtable single-select (your base); sync uses Draft/Closed defaults (override via OPS_ORDER_WORKFLOW_STATUS_*)",
  },
  {
    pdfRef: "§7",
    requirement: "Data fields in workflow",
    status: "Partial",
    implementedWhere:
      "/ops/orders shows order ref, status, severity, supplier, store, lines, currency, owner, submit-by, email sent, tracking, ETA, shipment, risk date; Send log / audit / full schema stay in Airtable",
  },
  {
    pdfRef: "§8",
    requirement: "Rules (ownership, gates, escalation, no casual close)",
    status: "Partial",
    implementedWhere:
      "API **delayFlagged** bucket + Airtable permissions/Interfaces + n8n notifications from reminders workflow",
    notes: "Owner on create: sync + `OPS_ORDER_DEFAULT_OWNER_EMAIL`.",
  },
  {
    pdfRef: "§1 / §9",
    requirement: "Manager opens system (read-only visibility without Airtable)",
    status: "Partial",
    implementedWhere: "/ops/orders (read-only progress view)",
    notes: "Optional OPS_BASIC_AUTH_USER + OPS_BASIC_AUTH_PASSWORD (middleware on /ops/*).",
  },
  {
    pdfRef: "Ops — schedule",
    requirement: "Create draft workflows on a schedule",
    status: "Partial",
    implementedWhere: "vercel.json cron → GET /api/cron/sync-order-workflows (Bearer CRON_SECRET)",
    notes: "Requires CRON_SECRET set on Vercel; adjust schedule in vercel.json if needed.",
  },
];

