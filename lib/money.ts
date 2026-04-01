/**
 * Parse Airtable number, currency, or text like "€15.00" / "$12.50" / "1.234,56".
 */
export function parseMoneyish(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  const s = String(value).trim();
  if (!s) return null;
  let t = s.replace(/[€$£\s\u00A3\u20AC]/g, "").trim();
  if (!t) return null;
  if (/,\d{1,2}$/.test(t)) {
    if (t.includes(".")) {
      t = t.replace(/\./g, "").replace(",", ".");
    } else {
      t = t.replace(",", ".");
    }
  } else {
    t = t.replace(/,/g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Currency you pay suppliers in (no GBP conversion in-app). */
export type PurchaseCurrency = "EUR" | "USD";

/**
 * Heuristic: PYT rows → USD; Opatra and everything else → EUR.
 * Override later with an explicit Airtable field if needed.
 */
export function inferPurchaseCurrencyFromBrand(brand?: string): PurchaseCurrency {
  const b = (brand ?? "").toLowerCase();
  if (b.includes("pyt")) return "USD";
  return "EUR";
}

export function formatMoney(amount: number, currency: PurchaseCurrency): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMoneyOptional(
  amount: number | null | undefined,
  currency: PurchaseCurrency
): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return formatMoney(amount, currency);
}

export function formatMoneyForBrand(brand: string | undefined, amount: number): string {
  return formatMoney(amount, inferPurchaseCurrencyFromBrand(brand));
}

export function formatMoneyForBrandOptional(
  brand: string | undefined,
  amount: number | null | undefined
): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return formatMoney(amount, inferPurchaseCurrencyFromBrand(brand));
}

/** Join non-zero supplier-currency totals for summaries (e.g. email). */
export function formatReorderTotalsEurUsd(eur: number, usd: number): string {
  const parts: string[] = [];
  if (eur > 0) parts.push(formatMoney(eur, "EUR"));
  if (usd > 0) parts.push(formatMoney(usd, "USD"));
  return parts.join(" · ");
}
