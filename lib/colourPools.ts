import type { ProductRecord } from "./airtable";
import { dateToYmd } from "./calendar";
import {
  applySupplierOrderConstraints,
  computeRawQtyToOrder,
  coverBufferDaysFromEnv,
} from "./reorderQty";

/** Synthetic ids for a colour range. Not an Airtable record. */
export const COLOUR_POOL_ID_PREFIX = "colour-pool:";

export function isColourPoolProductId(id: string): boolean {
  return id.startsWith(COLOUR_POOL_ID_PREFIX);
}

/**
 * PYT colour ranges whose stock covers the other colours in the same tool.
 * Keyed so a different product that merely shares an Airtable category stays separate
 * (3p Curling Set is not a Lola colour; Deep Curl is not a 19mm/25mm colour).
 */
export function colourPoolKey(p: ProductRecord): string | null {
  if (p.isColourPool || p.excludeFromReorder) return null;
  if ((p.productType ?? "").trim().toLowerCase() === "combo") return null;
  if (!(p.brand ?? "").toLowerCase().includes("pyt")) return null;

  const name = p.name.trim();
  const cat = (p.category ?? "").trim().toLowerCase();

  if (/^lola set\b/i.test(name)) return "pyt:lola-set";
  if (cat === "ceramic" || cat === "cerami") return "pyt:ceramic";
  if (cat === "infrared") return "pyt:infrared";
  if (cat === "titanium") return "pyt:titanium";
  if (cat === "19mm" && /^19mm\b/i.test(name)) return "pyt:19mm";
  if (cat === "25mm" && /^25mm\b/i.test(name)) return "pyt:25mm";
  return null;
}

const POOL_LABELS: Record<string, string> = {
  "pyt:ceramic": "Ceramic",
  "pyt:infrared": "Infrared",
  "pyt:titanium": "Titanium",
  "pyt:19mm": "19mm",
  "pyt:25mm": "25mm",
  "pyt:lola-set": "Lola Set",
};

export function colourPoolLabel(key: string): string {
  return POOL_LABELS[key] ?? key;
}

function roundUnits(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

/**
 * "120 Ceramic Black (0 other colours)" or
 * "34 Ceramic Unicorn, 10 Ceramic Black (0 other colours)".
 * Counts are units on hand. Incoming stays in the stock column and in the runway.
 */
export function formatColourPoolHoldings(members: ProductRecord[]): string {
  const held = members
    .filter((m) => m.currentStock > 0)
    .sort((a, b) => b.currentStock - a.currentStock || a.name.localeCompare(b.name));

  const parts = held.map((m) => `${roundUnits(m.currentStock)} ${m.name.trim()}`);

  const uncovered = members.filter((m) => m.currentStock <= 0 && m.incomingStockTotal <= 0).length;
  const body = parts.length > 0 ? parts.join(", ") : "0 in stock";
  return uncovered > 0 ? `${body} (0 other colours)` : body;
}

function maxPositive(values: Array<number | null | undefined>): number | null {
  let max: number | null = null;
  for (const v of values) {
    if (v == null || !Number.isFinite(v) || v <= 0) continue;
    max = max == null ? v : Math.max(max, v);
  }
  return max;
}

function sharedUnitPrice(members: ProductRecord[]): number | null {
  const prices = members
    .map((m) => m.pricePerUnit)
    .filter((n): n is number => n != null && Number.isFinite(n));
  if (prices.length === 0) return null;
  const first = prices[0]!;
  if (prices.every((n) => Math.abs(n - first) < 0.001)) return first;
  return null;
}

function buildColourPoolRecord(key: string, members: ProductRecord[]): ProductRecord {
  const label = colourPoolLabel(key);
  const currentStock = members.reduce((sum, m) => sum + (Number.isFinite(m.currentStock) ? m.currentStock : 0), 0);
  const incomingStockTotal = members.reduce(
    (sum, m) => sum + (Number.isFinite(m.incomingStockTotal) ? m.incomingStockTotal : 0),
    0
  );
  const effectiveStock = currentStock + incomingStockTotal;
  const dailyDemand = members.reduce((sum, m) => sum + (m.dailyDemand > 0 ? m.dailyDemand : 0), 0);
  const totalDemandThisMonth = members.reduce(
    (sum, m) => sum + (Number.isFinite(m.totalDemandThisMonth) ? m.totalDemandThisMonth : 0),
    0
  );

  let daysUntilRunOut: number | null = null;
  if (dailyDemand > 0) daysUntilRunOut = effectiveStock / dailyDemand;
  else if (effectiveStock === 0) daysUntilRunOut = null;

  const leadTimeDays = maxPositive(members.map((m) => m.leadTimeDays));

  let runOutDate: string | null = null;
  let orderByDate: string | null = null;
  if (daysUntilRunOut != null) {
    const runOut = new Date();
    runOut.setDate(runOut.getDate() + Math.round(daysUntilRunOut));
    runOutDate = dateToYmd(runOut);
    if (leadTimeDays != null) {
      const orderBy = new Date(runOut);
      orderBy.setDate(orderBy.getDate() - Math.round(leadTimeDays));
      orderByDate = dateToYmd(orderBy);
    }
  }

  const orderMoq = maxPositive(members.map((m) => m.orderMoq));
  const orderPackSize = maxPositive(members.map((m) => m.orderPackSize));
  const qtyBase = {
    effectiveStock,
    dailyDemand,
    leadTimeDays,
    excludeFromReorder: false,
  };
  const qtyToOrderRaw = computeRawQtyToOrder(qtyBase, coverBufferDaysFromEnv());
  const qtyToOrder = applySupplierOrderConstraints(qtyToOrderRaw, orderMoq, orderPackSize);

  const anchor = [...members].sort(
    (a, b) => b.effectiveStock - a.effectiveStock || b.currentStock - a.currentStock
  )[0]!;

  return {
    id: `${COLOUR_POOL_ID_PREFIX}${key}`,
    name: formatColourPoolHoldings(members),
    sku: null,
    brand: anchor.brand,
    productType: "Individual",
    category: label,
    supplier1: anchor.supplier1,
    supplier2: anchor.supplier2,
    currentStock,
    incomingStockTotal,
    effectiveStock,
    leadTimeDays,
    totalDemandThisMonth,
    dailyDemand,
    daysUntilRunOut,
    runOutDate,
    orderByDate,
    qtyToOrder,
    qtyToOrderRaw,
    orderMoq,
    orderPackSize,
    pricePerUnit: sharedUnitPrice(members),
    purchaseCurrency: anchor.purchaseCurrency,
    excludeFromReorder: false,
    airtableTable: "",
    briefingSnoozeUntil: null,
    briefingOrderedAt: null,
    isColourPool: true,
    colourPoolKey: key,
  };
}

/**
 * Replace two or more live colours in a range with one row.
 * Stock and sales are summed. A single colour in a range stays as its own product.
 */
export function applyColourPools(products: ProductRecord[]): ProductRecord[] {
  const groups = new Map<string, ProductRecord[]>();
  const passthrough: ProductRecord[] = [];

  for (const p of products) {
    const key = colourPoolKey(p);
    if (!key) {
      passthrough.push(p);
      continue;
    }
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  const pooled: ProductRecord[] = [];
  for (const [key, members] of groups) {
    if (members.length < 2) {
      passthrough.push(members[0]!);
      continue;
    }
    pooled.push(buildColourPoolRecord(key, members));
  }

  return [...passthrough, ...pooled];
}
