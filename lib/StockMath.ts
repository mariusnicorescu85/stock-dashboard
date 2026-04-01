export type StockInputs = {
  currentStock: number;
  incomingStock: number;
  dailyDemand: number;   // units/day
  leadTimeDays: number;  // days
};

export type StockDerived = {
  effectiveStock: number;
  daysUntilRunOut: number | null;
  runOutDate: Date | null;
  orderByDate: Date | null;
};

function startOfTodayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDaysUTC(base: Date, days: number) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return d;
}

export function computeStockDerived(input: StockInputs, today = startOfTodayUTC()): StockDerived {
  const current = Number.isFinite(input.currentStock) ? input.currentStock : 0;
  const incoming = Number.isFinite(input.incomingStock) ? input.incomingStock : 0;
  const daily = Number.isFinite(input.dailyDemand) ? input.dailyDemand : 0;
  const lead = Number.isFinite(input.leadTimeDays) ? input.leadTimeDays : 0;

  const effectiveStock = Math.max(0, current + incoming);

  if (daily <= 0) {
    return { effectiveStock, daysUntilRunOut: null, runOutDate: null, orderByDate: null };
  }

  const daysUntilRunOut = effectiveStock / daily;
  const runOutDate = addDaysUTC(today, daysUntilRunOut);
  const orderByDate = addDaysUTC(runOutDate, -lead);

  return { effectiveStock, daysUntilRunOut, runOutDate, orderByDate };
}

export function fmtGB(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB");
}

/** Calendar days in year (handles leap years). */
export function daysInYear(year: number): number {
  const y = Math.floor(year);
  const feb29 = new Date(y, 1, 29);
  return feb29.getMonth() === 1 ? 366 : 365;
}

/**
 * Days used to turn “units sold this calendar year” into an average daily rate.
 * Past/future years: full year length. Current calendar year: days from 1 Jan through today (inclusive, local).
 */
export function demandDaysDenominatorForYear(year: number, now = new Date()): number {
  const y = Math.floor(year);
  const cy = now.getFullYear();
  if (y !== cy) return daysInYear(y);

  const start = new Date(y, 0, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(1, Math.min(days, daysInYear(y)));
}

/** Days in month (month is 1–12). */
export function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}
