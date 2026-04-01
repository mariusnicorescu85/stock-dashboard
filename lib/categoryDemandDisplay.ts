import type { ProductRecord } from "./airtable";

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Round units/day for aggregates and inputs (avoid float noise from summing rows). */
export function roundDemandRate2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Daily / avg-day rates in category views — two decimal places. */
export function fmtDemandRate(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return n.toFixed(2);
}

export function monthlyForProduct(
  breakdown: Map<string, number[]>,
  productName: string
): number[] {
  return breakdown.get(productName) ?? Array(12).fill(0);
}

function normComponentName(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * For every monthly row whose name looks like "A + B + C", add that row's units (full amount)
 * to each component's running month total — same idea as bundle-driven usage on individuals.
 */
export function comboDemandExtraMonthsByNormComponent(
  breakdown: Map<string, number[]>
): Map<string, number[]> {
  const acc = new Map<string, number[]>();

  for (const [key, months] of breakdown) {
    if (!key.includes("+")) continue;
    const parts = key
      .split("+")
      .map((s) => normComponentName(s))
      .filter(Boolean);
    if (parts.length < 2) continue;

    for (const p of parts) {
      let row = acc.get(p);
      if (!row) {
        row = Array(12).fill(0);
        acc.set(p, row);
      }
      for (let m = 0; m < 12; m++) {
        row[m] += months[m] ?? 0;
      }
    }
  }

  return acc;
}

/** Own monthly line + optional Opatra-style bundle attribution per component name. */
export function monthlyRowMonths(
  breakdown: Map<string, number[]>,
  productName: string,
  comboExtraByNorm: Map<string, number[]> | null
): number[] {
  const own = monthlyForProduct(breakdown, productName);
  if (!comboExtraByNorm) return own;
  const extra = comboExtraByNorm.get(normComponentName(productName));
  if (!extra) return [...own];
  return own.map((v, i) => v + (extra[i] ?? 0));
}

function isOpatraBrand(p: ProductRecord): boolean {
  return (p.brand ?? "").toLowerCase().includes("opatra");
}

function opatraCategory(p: ProductRecord): string | null {
  if (!isOpatraBrand(p)) return null;
  const c = (p.category ?? "").trim();
  return c || null;
}

function isComboSku(p: ProductRecord): boolean {
  const t = (p.productType ?? "").trim().toLowerCase();
  if (t === "combo") return true;
  return p.name.includes("+");
}

/** Individual (non-combo) Opatra products for a category block — bundle demand is merged into these rows. */
export function opatraIndividualsInCategory(
  blockLabel: string,
  products: ProductRecord[]
): ProductRecord[] {
  const want = normComponentName(blockLabel);
  return products.filter((p) => {
    const g = opatraCategory(p);
    if (g == null || normComponentName(g) !== want) return false;
    if (isComboSku(p)) return false;
    return true;
  });
}

/** All Opatra products with this Airtable category (Combo block = bundle SKUs). */
export function opatraProductsInSheetCategory(
  blockLabel: string,
  products: ProductRecord[]
): ProductRecord[] {
  const want = normComponentName(blockLabel);
  return products.filter((p) => {
    const g = opatraCategory(p);
    return g != null && normComponentName(g) === want;
  });
}
