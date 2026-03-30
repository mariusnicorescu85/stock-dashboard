/**
 * Reorder quantity: bring effective stock up to a target that covers
 * supplier lead time plus an extra "buffer" of selling days (safety stock).
 *
 * targetUnits = (leadTimeDays + coverBufferDays) × dailyDemand
 * qtyToOrder = max(0, ⌈targetUnits − effectiveStock⌉)
 *
 * `effectiveStock` here matches the app: current + confirmed incoming.
 */
export const DEFAULT_COVER_BUFFER_DAYS = 30;

export function coverBufferDaysFromEnv(): number {
  const raw = process.env.STOCK_COVER_BUFFER_DAYS?.trim();
  if (raw == null || raw === "") return DEFAULT_COVER_BUFFER_DAYS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_COVER_BUFFER_DAYS;
  return Math.floor(n);
}

export function computeQtyToOrder(
  p: {
    effectiveStock: number;
    dailyDemand: number;
    leadTimeDays: number | null;
    excludeFromReorder: boolean;
  },
  coverBufferDays = DEFAULT_COVER_BUFFER_DAYS
): number {
  if (p.excludeFromReorder) return 0;
  if (p.dailyDemand <= 0) return 0;

  const lead = p.leadTimeDays != null && Number.isFinite(p.leadTimeDays) ? Math.max(0, p.leadTimeDays) : 0;
  const targetUnits = (lead + coverBufferDays) * p.dailyDemand;
  const gap = targetUnits - p.effectiveStock;
  if (gap <= 0) return 0;
  return Math.ceil(gap);
}
