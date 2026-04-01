import type { ProductRecord } from "./airtable";

export type ShopFilter = "all" | "pyt" | "opatra";

/** Calendar days from order to stock on hand — used when briefing decisions compare runway vs supplier time. */
export const SHOP_SUPPLIER_LEAD_DAYS = {
  pyt: 60,
  opatra: 14,
} as const;

/** Resolves by Airtable “Shop” / brand text (same rules as filters). Returns null if unknown — then use Airtable per-SKU lead if needed. */
export function supplierLeadDaysForBrand(brand: string | undefined): number | null {
  if (!brand) return null;
  if (brand.toLowerCase().includes("pyt")) return SHOP_SUPPLIER_LEAD_DAYS.pyt;
  if (brand.includes("Opatra")) return SHOP_SUPPLIER_LEAD_DAYS.opatra;
  return null;
}

export function parseShopFilter(
  raw: string | string[] | undefined
): ShopFilter {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s === "pyt" || s === "opatra") return s;
  return "all";
}

export function productMatchesShopFilter(
  p: ProductRecord,
  shop: ShopFilter
): boolean {
  if (shop === "all") return true;
  const brand = p.brand ?? "";
  if (shop === "pyt") return brand.toLowerCase().includes("pyt");
  if (shop === "opatra") return brand.includes("Opatra");
  return true;
}

export function filterProductsByShop(
  products: ProductRecord[],
  shop: ShopFilter
): ProductRecord[] {
  if (shop === "all") return products;
  return products.filter((p) => productMatchesShopFilter(p, shop));
}

export function shopFilterLabel(shop: ShopFilter): string {
  switch (shop) {
    case "pyt":
      return "PYT Hairstyle";
    case "opatra":
      return "Opatra";
    default:
      return "All shops";
  }
}
