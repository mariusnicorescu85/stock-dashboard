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

export function fmtDemandRate(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 10) return n.toFixed(1);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(3);
}

export function monthlyForProduct(
  breakdown: Map<string, number[]>,
  productName: string
): number[] {
  return breakdown.get(productName) ?? Array(12).fill(0);
}
