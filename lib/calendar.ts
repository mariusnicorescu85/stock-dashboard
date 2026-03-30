/** Calendar YYYY-MM-DD using the Date’s local components (matches `setDate` / `getDate`). */
export function dateToYmd(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Lexicographic compare for YYYY-MM-DD strings. */
export function ymdLessThan(a: string, b: string): boolean {
  return a < b;
}
