/**
 * Oldest calendar year to load from Monthly Sales / PYT Monthly Sales.
 * Raise or lower if your Airtable history starts later or earlier.
 */
export const EARLIEST_MONTHLY_HISTORY_YEAR = 2024;

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
