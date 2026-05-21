import { MONTH_SHORT } from "@/lib/categoryDemandDisplay";
import { daysInMonth } from "@/lib/StockMath";

export type DemandExportSlice = {
  productId: string;
  productName: string;
  brand: string | null;
  categoryLabel: string;
  year: number;
  month: number;
  units: number;
  impliedDaily: number;
};

export type CategoryDemandRowForExport = {
  id: string;
  name: string;
  brand?: string;
  byYear: { year: number; months: number[] }[];
};

export type CategoryDemandBlockForExport = {
  label: string;
  items: CategoryDemandRowForExport[];
};

export function demandSliceKey(productId: string, year: number, month: number): string {
  return `${productId}:${year}:${month}`;
}

export function parseDemandSliceKey(key: string): {
  productId: string;
  year: number;
  month: number;
} | null {
  const parts = key.split(":");
  if (parts.length !== 3) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  return { productId: parts[0], year, month };
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function sliceForYear(row: CategoryDemandRowForExport, calYear: number) {
  return (
    row.byYear.find((s) => s.year === calYear) ?? {
      year: calYear,
      totalUnits: 0,
      months: Array(12).fill(0),
    }
  );
}

export function indexCategoryProducts(blocks: CategoryDemandBlockForExport[]) {
  const map = new Map<
    string,
    { row: CategoryDemandRowForExport; categoryLabel: string }
  >();
  for (const block of blocks) {
    for (const row of block.items) {
      map.set(row.id, { row, categoryLabel: block.label });
    }
  }
  return map;
}

export function makeDemandSlice(
  productId: string,
  productName: string,
  brand: string | null | undefined,
  categoryLabel: string,
  year: number,
  month: number,
  units: number
): DemandExportSlice {
  const dim = daysInMonth(year, month);
  const impliedDaily = units > 0 && dim > 0 ? Math.round((units / dim) * 100) / 100 : 0;
  return {
    productId,
    productName,
    brand: brand ?? null,
    categoryLabel,
    year,
    month,
    units,
    impliedDaily,
  };
}

export function buildQuickExportSlices(
  blocks: CategoryDemandBlockForExport[],
  selectedProductIds: Set<string>,
  selectedYears: Set<number>,
  selectedMonths: Set<number>,
  includeZeros: boolean
): DemandExportSlice[] {
  const out: DemandExportSlice[] = [];
  for (const block of blocks) {
    for (const row of block.items) {
      if (!selectedProductIds.has(row.id)) continue;
      for (const year of selectedYears) {
        const sl = sliceForYear(row, year);
        for (const month of selectedMonths) {
          const units = sl.months[month - 1] ?? 0;
          if (!includeZeros && units <= 0) continue;
          out.push(
            makeDemandSlice(
              row.id,
              row.name,
              row.brand,
              block.label,
              year,
              month,
              units
            )
          );
        }
      }
    }
  }
  out.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== b.month) return a.month - b.month;
    const cat = a.categoryLabel.localeCompare(b.categoryLabel, undefined, {
      sensitivity: "base",
    });
    if (cat !== 0) return cat;
    return a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" });
  });
  return out;
}

export function buildCategoryDemandCsv(
  shopLabel: string,
  slices: DemandExportSlice[]
): string {
  const header = [
    "shop",
    "category",
    "product",
    "brand",
    "year",
    "month",
    "month_label",
    "units",
    "implied_daily",
  ]
    .map(csvEscape)
    .join(",");
  const body = slices.map((s) =>
    [
      csvEscape(shopLabel),
      csvEscape(s.categoryLabel),
      csvEscape(s.productName),
      csvEscape(s.brand ?? ""),
      String(s.year),
      String(s.month),
      csvEscape(MONTH_SHORT[s.month - 1] ?? ""),
      String(s.units),
      s.impliedDaily > 0 ? s.impliedDaily.toFixed(2) : "0",
    ].join(",")
  );
  return [header, ...body].join("\r\n");
}

export function categoryDemandCsvFilename(
  shopLabel: string,
  mode: "quick" | "basket"
): string {
  const safe =
    shopLabel.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "demand";
  const date = new Date().toISOString().slice(0, 10);
  return `category-demand-${mode}-${safe}-${date}.csv`;
}

export function downloadCategoryDemandCsv(
  shopLabel: string,
  slices: DemandExportSlice[],
  mode: "quick" | "basket"
): void {
  if (slices.length === 0) return;
  const csv = buildCategoryDemandCsv(shopLabel, slices);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = categoryDemandCsvFilename(shopLabel, mode);
  a.click();
  URL.revokeObjectURL(url);
}

export function formatDemandSliceLabel(slice: DemandExportSlice): string {
  const monthLabel = MONTH_SHORT[slice.month - 1] ?? String(slice.month);
  return `${slice.productName} · ${monthLabel} ${slice.year} · ${slice.units} units`;
}
