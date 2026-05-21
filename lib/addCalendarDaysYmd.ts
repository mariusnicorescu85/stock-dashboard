import { dateToYmd } from "./calendar";

/** `baseYmd` is YYYY-MM-DD; shifts by calendar days using local noon to avoid DST edge cases near midnight. */
export function addCalendarDaysYmd(baseYmd: string, deltaDays: number): string | null {
  const parts = baseYmd.split("-").map((s) => Number(s));
  const [y, m, d] = parts;
  if (!y || !m || !d || parts.some((n) => !Number.isFinite(n))) return null;
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  dt.setDate(dt.getDate() + deltaDays);
  return dateToYmd(dt);
}
