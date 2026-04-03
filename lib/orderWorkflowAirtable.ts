import { dateToYmd } from "./calendar";
import { fetchProducts, type ProductRecord } from "./airtable";
import { partitionRunoutBuckets } from "./stockBriefing";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_SUPPLIERS_TABLE =
  process.env.AIRTABLE_SUPPLIERS_TABLE?.trim() || "Suppliers";

const AIRTABLE_PYT_PRODUCTS_TABLE =
  process.env.AIRTABLE_PYT_PRODUCTS_TABLE?.trim() || "PYT Products";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Escape a string for use inside single quotes in Airtable `filterByFormula`. */
function escapeAirtableFormulaString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function workflowTable(): string | null {
  return process.env.AIRTABLE_ORDER_WORKFLOWS_TABLE?.trim() || null;
}

function linesTable(): string | null {
  return process.env.AIRTABLE_ORDER_LINES_TABLE?.trim() || null;
}

function draftStatus(): string {
  return (
    process.env.OPS_ORDER_WORKFLOW_STATUS_DRAFT?.trim() || "Draft order created"
  );
}

function closedStatus(): string {
  return process.env.OPS_ORDER_WORKFLOW_STATUS_CLOSED?.trim() || "Closed";
}

function lineLinkFieldOpatra(): string {
  return process.env.AIRTABLE_ORDER_LINES_PRODUCTS_OPATRA_FIELD?.trim() || "Products Opatra";
}

function lineLinkFieldPyt(): string {
  return process.env.AIRTABLE_ORDER_LINES_PRODUCTS_PYT_FIELD?.trim() || "Products PYT";
}

function lineSkuField(): string {
  return process.env.AIRTABLE_ORDER_LINES_SKU_FIELD?.trim() || "SKU/Product code";
}

function lineProductNameField(): string {
  return process.env.AIRTABLE_ORDER_LINES_NAME_FIELD?.trim() || "Product name";
}

function lineQtyField(): string {
  return process.env.AIRTABLE_ORDER_LINES_QTY_FIELD?.trim() || "Required quantity";
}

function lineUnitCostField(): string {
  return process.env.AIRTABLE_ORDER_LINES_UNIT_COST_FIELD?.trim() || "Unit cost";
}

function lineLineLabelField(): string {
  return process.env.AIRTABLE_ORDER_LINES_LABEL_FIELD?.trim() || "Line label";
}

function lineWorkflowLinkField(): string {
  return process.env.AIRTABLE_ORDER_LINES_WORKFLOW_LINK_FIELD?.trim() || "Order workflows";
}

function workflowOrderRefField(): string {
  return process.env.AIRTABLE_ORDER_FIELD_ORDER_REF?.trim() || "Order reference";
}

function workflowStatusField(): string {
  return process.env.AIRTABLE_ORDER_FIELD_STATUS?.trim() || "Status";
}

function workflowSupplierNameField(): string {
  return process.env.AIRTABLE_ORDER_FIELD_SUPPLIER_NAME?.trim() || "Supplier name";
}

function workflowSupplierEmailField(): string {
  return process.env.AIRTABLE_ORDER_FIELD_SUPPLIER_EMAIL?.trim() || "Supplier email";
}

function workflowStoreField(): string {
  return process.env.AIRTABLE_ORDER_FIELD_STORE?.trim() || "Store";
}

function workflowCurrencyField(): string {
  return process.env.AIRTABLE_ORDER_FIELD_CURRENCY?.trim() || "Currency";
}

function workflowTriggerDateField(): string {
  return (
    process.env.AIRTABLE_ORDER_FIELD_STOCK_RISK_DATE?.trim() || "Stock-risk trigger date"
  );
}

function workflowDedupeField(): string {
  return process.env.AIRTABLE_ORDER_FIELD_DEDUPE_KEY?.trim() || "Dedupe key";
}

function workflowGeneratedDateField(): string {
  return process.env.AIRTABLE_ORDER_FIELD_GENERATED_DATE?.trim() || "Generated date";
}

/** PDF §4.2 — worst-case runway in the group (Critical / High / Medium). Override name via env. */
function workflowSeverityField(): string {
  return process.env.AIRTABLE_ORDER_FIELD_SEVERITY?.trim() || "Severity";
}

/** PDF §4.3 — text/email owner on new drafts when `OPS_ORDER_DEFAULT_OWNER_EMAIL` is set. */
function workflowAssignedOwnerField(): string {
  return process.env.AIRTABLE_ORDER_FIELD_ASSIGNED_OWNER?.trim() || "Assigned owner";
}

/** PDF — supplier submission target date on new drafts (today + N days). Override name via env. */
function workflowSubmissionDeadlineField(): string {
  return (
    process.env.AIRTABLE_ORDER_FIELD_SUBMISSION_DEADLINE?.trim() || "Submission deadline"
  );
}

function submissionDeadlineDays(): number {
  const raw = process.env.OPS_ORDER_SUBMISSION_DEADLINE_DAYS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 3;
  return Number.isFinite(n) && n >= 0 ? n : 3;
}

function defaultOwnerEmail(): string | null {
  const v = process.env.OPS_ORDER_DEFAULT_OWNER_EMAIL?.trim();
  return v || null;
}

function writeSeverityOnSync(): boolean {
  return process.env.OPS_ORDER_DISABLE_SEVERITY?.trim() !== "1";
}

function writeSubmissionDeadlineOnSync(): boolean {
  return process.env.OPS_ORDER_DISABLE_SUBMISSION_DEADLINE?.trim() !== "1";
}

/** Aligns with dashboard urgency bands (0–7 / 8–14 / 15–30 / rest). */
function severityForReorderGroup(rows: ProductRecord[]): string {
  const daysList = rows
    .map((r) => r.daysUntilRunOut)
    .filter((d): d is number => d != null && Number.isFinite(d));
  if (daysList.length === 0) return "Medium";
  const min = Math.min(...daysList);
  if (min <= 7) return "Critical";
  if (min <= 14) return "High";
  return "Medium";
}

function primarySupplier(p: ProductRecord): string {
  const s = (p.supplier1 || p.supplier2 || "").trim();
  return s || "Unknown supplier";
}

function storeLabel(p: ProductRecord): string {
  return (p.brand || "").trim() || "Unknown store";
}

export function dedupeKeyForReorderGroup(p: ProductRecord): string {
  return `${primarySupplier(p)}|${storeLabel(p)}|${p.purchaseCurrency}`;
}

function orderLineProductsLinkField(p: ProductRecord): string {
  return p.airtableTable === AIRTABLE_PYT_PRODUCTS_TABLE
    ? lineLinkFieldPyt()
    : lineLinkFieldOpatra();
}

function newOrderReference(): string {
  const ymd = dateToYmd(new Date());
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${ymd}-${rand}`;
}

async function fetchSupplierEmailsByName(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!AIRTABLE_API_KEY?.trim() || !AIRTABLE_BASE_ID?.trim()) return map;

  const url = new URL(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
      AIRTABLE_SUPPLIERS_TABLE
    )}`
  );

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    next: { revalidate: 300 },
  });

  if (!res.ok) return map;

  const data = (await res.json()) as {
    records?: Array<{ fields?: Record<string, unknown> }>;
  };

  for (const r of data.records ?? []) {
    const f = r.fields ?? {};
    const name = f["Supplier"];
    const email = f["Email"] ?? f["email"] ?? f["Supplier email"];
    if (typeof name !== "string" || !name.trim()) continue;
    if (typeof email !== "string" || !email.includes("@")) continue;
    map.set(name.trim(), email.trim());
  }

  return map;
}

async function findOpenWorkflowRecordId(
  wfTable: string,
  dedupeKey: string
): Promise<string | null> {
  const dedupeField = workflowDedupeField();
  const statusField = workflowStatusField();
  const closed = closedStatus();

  const formula = `AND({${dedupeField}}='${escapeAirtableFormulaString(
    dedupeKey
  )}', {${statusField}}!='${escapeAirtableFormulaString(closed)}')`;

  const url = new URL(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(wfTable)}`
  );
  url.searchParams.set("filterByFormula", formula);
  url.searchParams.set("maxRecords", "1");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable list workflows failed: ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as { records?: Array<{ id: string }> };
  return data.records?.[0]?.id ?? null;
}

async function createAirtableRecords(
  table: string,
  records: Array<{ fields: Record<string, unknown> }>
): Promise<string[]> {
  const ids: string[] = [];
  const chunkSize = 10;

  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: chunk }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable create in ${table} failed: ${text.slice(0, 500)}`);
    }

    const data = (await res.json()) as { records?: Array<{ id: string }> };
    for (const r of data.records ?? []) ids.push(r.id);
    await sleep(200);
  }

  return ids;
}

export type SyncOrderWorkflowsResult = {
  ok: boolean;
  /** When env tables are not set. */
  disabled?: boolean;
  message?: string;
  dryRun?: boolean;
  created: Array<{
    orderReference: string;
    dedupeKey: string;
    supplier: string;
    store: string;
    currency: string;
    lineCount: number;
  }>;
  skipped: Array<{ dedupeKey: string; reason: string }>;
  error?: string;
};

/**
 * Create open **Order workflows** + **Order lines** from {@link partitionRunoutBuckets} → `needingOrder`,
 * grouped by primary supplier + store + purchase currency. Skips groups that already have a non-closed workflow
 * for the same **Dedupe key**.
 */
export async function syncOrderWorkflowsFromProducts(options?: {
  dryRun?: boolean;
}): Promise<SyncOrderWorkflowsResult> {
  const wfTable = workflowTable();
  const lnTable = linesTable();

  if (!wfTable || !lnTable) {
    return {
      ok: true,
      disabled: true,
      message:
        "Set AIRTABLE_ORDER_WORKFLOWS_TABLE and AIRTABLE_ORDER_LINES_TABLE in .env.local to enable sync.",
      created: [],
      skipped: [],
    };
  }

  const dryRun = options?.dryRun === true;
  const created: SyncOrderWorkflowsResult["created"] = [];
  const skipped: SyncOrderWorkflowsResult["skipped"] = [];

  try {
    const [products, supplierEmails] = await Promise.all([
      fetchProducts(),
      fetchSupplierEmailsByName(),
    ]);

    const { needingOrder } = partitionRunoutBuckets(products);

    const groups = new Map<string, ProductRecord[]>();
    for (const p of needingOrder) {
      if (p.qtyToOrder <= 0) continue;
      const key = dedupeKeyForReorderGroup(p);
      const list = groups.get(key);
      if (list) list.push(p);
      else groups.set(key, [p]);
    }

    for (const [dedupeKey, rows] of groups) {
      const first = rows[0]!;
      const supplier = primarySupplier(first);
      const store = storeLabel(first);
      const currency = first.purchaseCurrency;

      const existingId = await findOpenWorkflowRecordId(wfTable, dedupeKey);
      if (existingId) {
        skipped.push({ dedupeKey, reason: "open workflow already exists" });
        continue;
      }

      const orderReference = newOrderReference();
      const todayYmd = dateToYmd(new Date());
      const supplierEmail = supplierEmails.get(supplier) ?? "";

      const wfFields: Record<string, unknown> = {
        [workflowOrderRefField()]: orderReference,
        [workflowStatusField()]: draftStatus(),
        [workflowSupplierNameField()]: supplier,
        [workflowStoreField()]: store,
        [workflowCurrencyField()]: currency,
        [workflowTriggerDateField()]: todayYmd,
        [workflowDedupeField()]: dedupeKey,
        [workflowGeneratedDateField()]: todayYmd,
      };

      if (supplierEmail) {
        wfFields[workflowSupplierEmailField()] = supplierEmail;
      }

      if (writeSeverityOnSync()) {
        wfFields[workflowSeverityField()] = severityForReorderGroup(rows);
      }

      const ownerEmail = defaultOwnerEmail();
      if (ownerEmail) {
        wfFields[workflowAssignedOwnerField()] = ownerEmail;
      }

      if (writeSubmissionDeadlineOnSync()) {
        const d = new Date();
        d.setDate(d.getDate() + submissionDeadlineDays());
        wfFields[workflowSubmissionDeadlineField()] = dateToYmd(d);
      }

      if (dryRun) {
        created.push({
          orderReference,
          dedupeKey,
          supplier,
          store,
          currency,
          lineCount: rows.length,
        });
        continue;
      }

      const wfIds = await createAirtableRecords(wfTable, [{ fields: wfFields }]);
      const workflowId = wfIds[0];
      if (!workflowId) throw new Error("Workflow create returned no id");

      const lineRecords: Array<{ fields: Record<string, unknown> }> = rows.map(
        (p) => {
          const sku = p.sku ?? "";
          const label = `${sku || p.id} — ${p.name}`.slice(0, 200);
          const linkField = orderLineProductsLinkField(p);
          const fields: Record<string, unknown> = {
            [lineLineLabelField()]: label,
            [lineWorkflowLinkField()]: [workflowId],
            [lineSkuField()]: sku || p.name,
            [lineProductNameField()]: p.name,
            [lineQtyField()]: Math.max(0, Math.floor(p.qtyToOrder)),
          };
          if (p.pricePerUnit != null && Number.isFinite(p.pricePerUnit)) {
            fields[lineUnitCostField()] = p.pricePerUnit;
          }
          fields[linkField] = [p.id];
          return { fields };
        }
      );

      await createAirtableRecords(lnTable, lineRecords);

      created.push({
        orderReference,
        dedupeKey,
        supplier,
        store,
        currency,
        lineCount: rows.length,
      });
    }

    return { ok: true, dryRun, created, skipped };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message, created, skipped };
  }
}
