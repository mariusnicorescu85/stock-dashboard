// lib/airtable.ts

export type ProductRecord = {
  id: string;
  name: string;
  brand?: string;
  productType?: string;
  category?: string;

  supplier1?: string;
  supplier2?: string;

  currentStock: number;
  incomingStockTotal: number;
  effectiveStock: number;

  leadTimeDays: number | null;
  totalDemandThisMonth: number;
  dailyDemand: number;

  daysUntilRunOut: number | null;
  runOutDate: string | null;
  orderByDate: string | null;
  qtyToOrder: number;
};

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

const AIRTABLE_PRODUCTS_TABLE = process.env.AIRTABLE_PRODUCTS_TABLE || "Products";
const AIRTABLE_PYT_PRODUCTS_TABLE = process.env.AIRTABLE_PYT_PRODUCTS_TABLE || "PYT Products";
const AIRTABLE_MONTHLY_TABLE = process.env.AIRTABLE_MONTHLY_TABLE || "Monthly Sales";
const AIRTABLE_PYT_MONTHLY_SALES_TABLE =
  process.env.AIRTABLE_PYT_MONTHLY_SALES_TABLE || "PYT Monthly Sales";
const AIRTABLE_SUPPLIERS_TABLE = process.env.AIRTABLE_SUPPLIERS_TABLE || "Suppliers";

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  throw new Error("Missing Airtable env vars");
}

type AirtableRecord = {
  id: string;
  fields: Record<string, any>;
};

// -----------------------------
// Supplier helpers
// -----------------------------

async function fetchSuppliers(): Promise<Record<string, string>> {
  const url = new URL(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
      AIRTABLE_SUPPLIERS_TABLE
    )}`
  );

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    next: { revalidate: 300 },
  });

  if (!res.ok) throw new Error("Failed to fetch suppliers");

  const data = await res.json();
  const map: Record<string, string> = {};

  for (const r of data.records ?? []) {
    const name = r.fields["Supplier"];
    if (name) map[r.id] = name;
  }

  return map;
}

// -----------------------------
// Product helpers
// -----------------------------

async function fetchProductsFromTable(tableName: string): Promise<ProductRecord[]> {
  const url = new URL(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`
  );

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    next: { revalidate: 60 },
  });

  if (!res.ok) throw new Error(`Failed to fetch products from ${tableName}`);

  const data = await res.json();

  return (data.records ?? []).map((r: AirtableRecord) => {
    const f = r.fields;

    // ---- stock ----
    const currentStock = Number(f["Current Stock"] ?? 0);
    const incomingStockTotal =
      Number(f["Incoming Stock - Supplier 1"] ?? 0) +
      Number(f["Incoming Stock - Supplier 2"] ?? 0);
    const effectiveStock = currentStock + incomingStockTotal;

    // ---- suppliers ----
    const supplier1Field = f["Supplier 1"] ?? f["Suppliers"];
    const supplier2Field = f["Supplier 2"] ?? f["Suppliers 2"];

    // ---- demand ----
    const totalDemandThisMonth = Number(
      f["total demand - this month 2024"] ?? f["Demand This Month"] ?? 0
    );

    let dailyDemand = Number(
      f["daily consumption rate - based on 2024 pattern"] ??
        f["Daily Consumption Rate - based on 2024 data"] ??
        0
    );

    // Fallback: if we have a monthly demand but no daily rate from Airtable,
    // approximate daily demand from this month's total.
    if (dailyDemand <= 0 && totalDemandThisMonth > 0) {
      const today = new Date();
      const daysInMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
      ).getDate();

      if (daysInMonth > 0) {
        dailyDemand = totalDemandThisMonth / daysInMonth;
      }
    }

    // ---- runway ----
    let daysUntilRunOut: number | null = null;

    if (dailyDemand > 0) {
      daysUntilRunOut = effectiveStock / dailyDemand;
    }
    if (effectiveStock === 0) {
      daysUntilRunOut = 0;
    }

    // ---- lead time ----
    const leadTimeDays =
      f["Lead Time (Days)"] != null
        ? Number(f["Lead Time (Days)"])
        : f["Lead Time - Days"] != null
        ? Number(f["Lead Time - Days"])
        : null;

    // ---- dates (COMPUTED, NOT AIRTABLE) ----
    const today = new Date();

    let runOutDate: string | null = null;
    let orderByDate: string | null = null;

    if (daysUntilRunOut != null) {
      const runOut = new Date(today);
      runOut.setDate(runOut.getDate() + Math.round(daysUntilRunOut));
      runOutDate = runOut.toISOString().slice(0, 10);

      if (leadTimeDays != null) {
        const orderBy = new Date(runOut);
        orderBy.setDate(orderBy.getDate() - leadTimeDays);
        orderByDate = orderBy.toISOString().slice(0, 10);
      }
    }

    return {
      id: r.id,
      name: String(f["Product"] ?? ""),
      brand: f["Shop"],
      productType: f["Product Type"],
      category: f["Category"],

      supplier1: supplier1Field?.[0],
      supplier2: supplier2Field?.[0],

      currentStock,
      incomingStockTotal,
      effectiveStock,

      leadTimeDays,
      totalDemandThisMonth,
      dailyDemand,

      daysUntilRunOut,
      runOutDate,
      orderByDate,

      qtyToOrder: Number(f["quantity to order"] ?? f["Quantity To Order"] ?? 0),
    };
  });
}

export async function fetchProducts(): Promise<ProductRecord[]> {
  const tables = [AIRTABLE_PRODUCTS_TABLE, AIRTABLE_PYT_PRODUCTS_TABLE];

  const [supplierMap, ...productBatches] = await Promise.all([
    fetchSuppliers(),
    ...tables.map((t) => fetchProductsFromTable(t)),
  ]);

  const products = productBatches.flat();

  for (const p of products) {
    if (p.supplier1 && supplierMap[p.supplier1]) p.supplier1 = supplierMap[p.supplier1];
    if (p.supplier2 && supplierMap[p.supplier2]) p.supplier2 = supplierMap[p.supplier2];
  }

  return products;
}

export async function fetchDemandForYearMonth(year: number, month: number) {
  const tables = [AIRTABLE_MONTHLY_TABLE, AIRTABLE_PYT_MONTHLY_SALES_TABLE].filter(Boolean);

  const results = await Promise.all(
    tables.map(async (tableName) => {
      const url = new URL(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`
      );

      const formula = `AND({Year}=${year}, {Month}=${month})`;
      url.searchParams.set("filterByFormula", formula);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        next: { revalidate: 300 },
      });

      if (!res.ok) {
        console.error("Airtable error (demand year-month):", await res.text());
        throw new Error(`Failed to fetch monthly demand from ${tableName}`);
      }

      const data = await res.json();
      const records: AirtableRecord[] = data.records || [];

      const map = new Map<string, number>();

      for (const r of records) {
        const f = r.fields;

        const productFieldAny = f["Product"];
        const productField = typeof productFieldAny === "string" ? productFieldAny : null;

        const label = String(f["Record"] ?? "");
        const parsed =
          label.includes(" - ")
            ? label.split(" - ").slice(1).join(" - ").trim()
            : label.includes(" – ")
              ? label.split(" – ").slice(1).join(" – ").trim()
              : label;

        const productName = (productField ?? parsed).trim();
        if (!productName) continue;

        const units = Number(f["Units Sold"] ?? 0);
        map.set(productName, (map.get(productName) ?? 0) + units);
      }

      return map;
    })
  );

  const merged = new Map<string, number>();
  for (const m of results) {
    for (const [k, v] of m.entries()) {
      merged.set(k, (merged.get(k) ?? 0) + v);
    }
  }

  return merged;
}

// Fetch total demand per product for an entire year (sum of all 12 months)
export async function fetchDemandForYear(year: number): Promise<Map<string, number>> {
  const yearly = new Map<string, number>();

  for (let month = 1; month <= 12; month++) {
    const monthly = await fetchDemandForYearMonth(year, month);

    for (const [name, units] of monthly.entries()) {
      const key = name.trim();
      if (!key) continue;
      yearly.set(key, (yearly.get(key) ?? 0) + units);
    }
  }

  return yearly;
}

// -----------------------------
// Monthly sales per product (for compare & detail views)
// -----------------------------

export type MonthlySaleRecord = {
  id: string;
  label: string;
  monthStart: string | null;
  year: number | null;
  month: number | null;
  unitsSold: number;
  monthlyDemand: number | null;
  dailyDemand: number | null;
};

export async function fetchMonthlySalesForProduct(
  productName: string
): Promise<MonthlySaleRecord[]> {
  const nameLower = productName.trim().toLowerCase();
  if (!nameLower) return [];

  const tables = [AIRTABLE_MONTHLY_TABLE, AIRTABLE_PYT_MONTHLY_SALES_TABLE].filter(Boolean);
  const results: MonthlySaleRecord[] = [];

  for (const tableName of tables) {
    let offset: string | undefined;

    do {
      const url = new URL(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`
      );

      url.searchParams.set("pageSize", "100");
      url.searchParams.set("filterByFormula", "AND({Units Sold} > 0, {Record} != '')");
      if (offset) url.searchParams.set("offset", offset);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        next: { revalidate: 300 },
      });

      if (!res.ok) {
        console.error("Airtable error (monthly sales for product):", await res.text());
        throw new Error(`Failed to fetch monthly sales from ${tableName}`);
      }

      const data = await res.json();
      const records: AirtableRecord[] = data.records ?? [];

      for (const r of records) {
        const f = r.fields;
        const units = Number(f["Units Sold"] ?? 0);
        if (!Number.isFinite(units) || units <= 0) continue;

        const rawLabel = String(f["Record"] ?? "");
        if (!rawLabel) continue;

        // Strip leading "YYYY-MM - " / "YYYY-MM – " to get the product part
        const namePart = rawLabel.replace(/^\d{4}-\d{2}\s*[–-]\s*/u, "").trim();
        if (!namePart) continue;

        // Record can be a single item or a combo "A + B + C". Split and see if our product is in there.
        const components = namePart
          .split("+")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);

        if (!components.includes(nameLower)) continue;

        const yearRaw = Number(f["Year"]);
        const monthRaw = Number(f["Month"]);
        const hasYearMonth =
          Number.isFinite(yearRaw) &&
          Number.isFinite(monthRaw) &&
          monthRaw >= 1 &&
          monthRaw <= 12;

        const year = hasYearMonth ? yearRaw : null;
        const month = hasYearMonth ? monthRaw : null;

        const monthStart =
          hasYearMonth && year != null && month != null
            ? `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}-01`
            : null;

        let monthlyDemand: number | null = null;
        let dailyDemand: number | null = null;

        if (hasYearMonth && year != null && month != null) {
          monthlyDemand = units;
          const daysInMonth = new Date(year, month, 0).getDate();
          dailyDemand = daysInMonth > 0 ? units / daysInMonth : null;
        }

        results.push({
          id: r.id,
          label: rawLabel,
          monthStart,
          year,
          month,
          unitsSold: units,
          monthlyDemand,
          dailyDemand,
        });
      }

      offset = data.offset;
    } while (offset);
  }

  return results;
}

export type CategoryDemandMap = Map<string, number>;

// Aggregate yearly product demand into category totals using the Product records
export function computeCategoryDemandFromYearly(
  products: ProductRecord[],
  yearlyDemand: Map<string, number>
): CategoryDemandMap {
  const categoryTotals: CategoryDemandMap = new Map();

  // Map product name -> category based on the Products tables
  const nameToCategory = new Map<string, string>();
  for (const p of products) {
    const key = p.name?.trim();
    if (!key) continue;
    nameToCategory.set(key, p.category ?? "Uncategorised");
  }

  // Walk the yearly demand by product name and roll up into categories
  for (const [rawName, units] of yearlyDemand.entries()) {
    const name = rawName.trim();
    if (!name) continue;

    const category = nameToCategory.get(name) ?? "Uncategorised";
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + units);
  }

  return categoryTotals;
}

export type SalesTotals = {
  individual: number;
  combo: number;
  all: number;
};

export async function fetchSalesTotalsAllTime(): Promise<Map<string, SalesTotals>> {
  const tables = [AIRTABLE_MONTHLY_TABLE, AIRTABLE_PYT_MONTHLY_SALES_TABLE].filter(Boolean);
  const totals = new Map<string, SalesTotals>();

  function bump(name: string, kind: "individual" | "combo", units: number) {
    const key = name.trim();
    if (!key) return;

    const cur = totals.get(key) ?? { individual: 0, combo: 0, all: 0 };
    cur[kind] += units;
    cur.all += units;
    totals.set(key, cur);
  }

  for (const tableName of tables) {
    let offset: string | undefined;

    do {
      const url = new URL(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`
      );

      url.searchParams.set("pageSize", "100");
      url.searchParams.set("filterByFormula", "AND({Units Sold} > 0, {Record} != '')");
      if (offset) url.searchParams.set("offset", offset);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        next: { revalidate: 300 },
      });

      if (!res.ok) {
        console.error("Airtable error (totals all time):", await res.text());
        throw new Error(`Failed to fetch totals from ${tableName}`);
      }

      const data = await res.json();
      const records = data.records ?? [];

      for (const r of records) {
        const label = String(r.fields?.Record ?? "");
        const units = Number(r.fields?.["Units Sold"] ?? 0);
        if (!label || !Number.isFinite(units)) continue;

        const namePart = label.replace(/^\d{4}-\d{2}\s*[–-]\s*/u, "").trim();

        if (namePart.includes("+")) {
          namePart
            .split("+")
            .map((s: string) => s.trim())
            .forEach((c: string) => bump(c, "combo", units));
        } else {
          bump(namePart, "individual", units);
        }
      }

      offset = data.offset;
    } while (offset);
  }

  return totals;
}
