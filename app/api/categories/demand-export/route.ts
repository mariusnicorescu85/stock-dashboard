import { NextResponse } from "next/server";
import { fetchDemandForYearMonth, fetchProducts, type ProductRecord } from "@/lib/airtable";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type MonthKey = { year: number; month: number }; // month: 1..12

function parseYyyyMm(s: string | null): MonthKey | null {
  const raw = (s ?? "").trim();
  const m = raw.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function monthKeyToYyyyMm(k: MonthKey): string {
  return `${k.year.toString().padStart(4, "0")}-${String(k.month).padStart(2, "0")}`;
}

function cmpMonthKey(a: MonthKey, b: MonthKey): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

function addMonths(k: MonthKey, delta: number): MonthKey {
  const d = new Date(k.year, k.month - 1, 1);
  d.setMonth(d.getMonth() + delta);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function monthRangeInclusive(from: MonthKey, to: MonthKey): MonthKey[] {
  if (cmpMonthKey(from, to) > 0) return [];
  const out: MonthKey[] = [];
  let cur = from;
  // Hard cap: prevent accidentally generating huge exports.
  for (let i = 0; i < 240; i++) {
    out.push(cur);
    if (cur.year === to.year && cur.month === to.month) break;
    cur = addMonths(cur, 1);
  }
  return out;
}

function csvEscape(v: string): string {
  if (v.includes('"') || v.includes(",") || v.includes("\n") || v.includes("\r")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function isOpatraBrand(p: ProductRecord): boolean {
  return (p.brand ?? "").toLowerCase().includes("opatra");
}

function isComboSku(p: ProductRecord): boolean {
  const t = (p.productType ?? "").trim().toLowerCase();
  if (t === "combo") return true;
  return p.name.includes("+");
}

function normName(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * For one calendar month, build an attributed unit map for Opatra:
 * - Base units: exact product name units from monthly sales tables.
 * - Attribution: if a row name contains "A + B + C", add the FULL units to each component A,B,C.
 */
function attributedUnitsForMonth(rawUnitsByName: Map<string, number>): Map<string, number> {
  const byNorm = new Map<string, number>();
  for (const [name, units] of rawUnitsByName.entries()) {
    const k = normName(name);
    if (!k) continue;
    byNorm.set(k, (byNorm.get(k) ?? 0) + (Number.isFinite(units) ? units : 0));
  }

  const comboExtra = new Map<string, number>();
  for (const [name, units] of rawUnitsByName.entries()) {
    if (!name.includes("+")) continue;
    const u = Number.isFinite(units) ? units : 0;
    if (u <= 0) continue;
    const parts = name
      .split("+")
      .map((s) => normName(s))
      .filter(Boolean);
    if (parts.length < 2) continue;
    for (const p of parts) {
      comboExtra.set(p, (comboExtra.get(p) ?? 0) + u);
    }
  }

  const out = new Map<string, number>();
  for (const [k, v] of byNorm.entries()) out.set(k, v);
  for (const [k, v] of comboExtra.entries()) out.set(k, (out.get(k) ?? 0) + v);
  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const shop = (searchParams.get("shop") ?? "opatra").trim().toLowerCase();
  const from = parseYyyyMm(searchParams.get("from"));
  const to = parseYyyyMm(searchParams.get("to"));
  const layout = (searchParams.get("layout") ?? "long").trim().toLowerCase(); // long | wide

  if (!from || !to) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Missing/invalid "from" or "to". Use YYYY-MM, e.g. from=2025-04&to=2026-03.',
      },
      { status: 400 }
    );
  }

  if (cmpMonthKey(from, to) > 0) {
    return NextResponse.json(
      { ok: false, error: '"from" must be <= "to".' },
      { status: 400 }
    );
  }

  if (shop !== "opatra") {
    return NextResponse.json(
      { ok: false, error: 'Only shop=opatra is supported for attributed export right now.' },
      { status: 400 }
    );
  }

  const months = monthRangeInclusive(from, to);
  if (months.length === 0) {
    return NextResponse.json({ ok: false, error: "Empty month range." }, { status: 400 });
  }
  if (layout !== "long" && layout !== "wide") {
    return NextResponse.json(
      { ok: false, error: 'Invalid "layout". Use layout=long or layout=wide.' },
      { status: 400 }
    );
  }

  const products = await fetchProducts();
  const opatraIndividuals = products
    .filter(isOpatraBrand)
    .filter((p) => !isComboSku(p))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  // Fetch each month sequentially to avoid Airtable burst limits.
  const attributedByMonth = new Map<string, Map<string, number>>();
  for (const mk of months) {
    const raw = await fetchDemandForYearMonth(mk.year, mk.month);
    attributedByMonth.set(monthKeyToYyyyMm(mk), attributedUnitsForMonth(raw));
  }

  const monthCols = months.map((m) => monthKeyToYyyyMm(m));
  const lines: string[] = [];

  if (layout === "wide") {
    lines.push(["sku", "product", ...monthCols, "total"].map(csvEscape).join(","));

    for (const p of opatraIndividuals) {
      const norm = normName(p.name);
      const rowMonths = monthCols.map((mc) => {
        const unitsMap = attributedByMonth.get(mc) ?? new Map<string, number>();
        const units = unitsMap.get(norm) ?? 0;
        return Number.isFinite(units) && units > 0 ? Math.round(units) : 0;
      });
      const total = rowMonths.reduce((s, u) => s + u, 0);
      // Keep fully-zero rows out to reduce noise.
      if (total <= 0) continue;

      lines.push(
        [
          csvEscape((p.sku ?? "").trim()),
          csvEscape(p.name),
          ...rowMonths.map(String),
          String(total),
        ].join(",")
      );
    }
  } else {
    lines.push(["month", "sku", "product", "units_sold"].map(csvEscape).join(","));

    for (const mk of months) {
      const monthStr = monthKeyToYyyyMm(mk);
      const unitsMap = attributedByMonth.get(monthStr) ?? new Map<string, number>();

      for (const p of opatraIndividuals) {
        const units = unitsMap.get(normName(p.name)) ?? 0;
        // Keep zeros out to reduce file size; Excel pivots still work.
        if (!Number.isFinite(units) || units <= 0) continue;
        lines.push(
          [
            csvEscape(monthStr),
            csvEscape((p.sku ?? "").trim()),
            csvEscape(p.name),
            String(Math.round(units)),
          ].join(",")
        );
      }
    }
  }

  const csv = lines.join("\n") + "\n";
  const filename = `demand-opatra-attributed-${layout}-${monthKeyToYyyyMm(from)}_to_${monthKeyToYyyyMm(
    to
  )}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

