import type { ProductRecord } from "./airtable";

export type ShopFilter = "all" | "pyt" | "opatra";

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
