import type { PurchaseCurrency } from "@/lib/money";

export type BuyingListRow = {
  id: string;
  name: string;
  brand: string | null;
  qtyToOrder: number;
  pricePerUnit: number | null;
  purchaseCurrency: PurchaseCurrency;
  orderByDate: string | null;
  /** Airtable table for PATCH (Products / PYT Products). */
  airtableTable: string;
};

export function formatOrderByForCsv(ymd: string | null) {
  if (!ymd) return "—";
  const d = new Date(ymd);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-GB");
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildBuyingListCsv(rows: Array<BuyingListRow & { qty: number }>) {
  const header = [
    "Product",
    "Brand",
    "Qty to order",
    "Price per unit (supplier ccy)",
    "Line total (supplier ccy)",
    "Order by",
  ]
    .map(csvEscape)
    .join(",");
  const body = rows.map((r) => {
    const q = Math.max(0, r.qty);
    const unit = r.pricePerUnit != null ? String(r.pricePerUnit) : "";
    const line =
      r.pricePerUnit != null && Number.isFinite(r.pricePerUnit)
        ? String(Math.round(q * r.pricePerUnit * 100) / 100)
        : "";
    return [
      csvEscape(r.name),
      csvEscape(r.brand ?? ""),
      String(q),
      unit,
      line,
      csvEscape(formatOrderByForCsv(r.orderByDate)),
    ].join(",");
  });
  return [header, ...body].join("\r\n");
}

export function buyingListCsvFilename(shopLabel: string) {
  const safe =
    shopLabel.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "buying-list";
  return `${safe}-${new Date().toISOString().slice(0, 10)}.csv`;
}
