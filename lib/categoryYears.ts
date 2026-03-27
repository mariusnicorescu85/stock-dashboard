/**
 * Oldest calendar year to load from Monthly Sales / PYT Monthly Sales.
 * Extend if you have older rows in Airtable.
 */
export const EARLIEST_MONTHLY_HISTORY_YEAR = 2022;

/** Inclusive range of years [floor … primaryYear], ascending. */
export function monthlyHistoryYearsUpTo(
  primaryYear: number,
  floorYear: number = EARLIEST_MONTHLY_HISTORY_YEAR
): number[] {
  const lo = Math.min(floorYear, primaryYear);
  const out: number[] = [];
  for (let y = lo; y <= primaryYear; y++) {
    out.push(y);
  }
  return out;
}
