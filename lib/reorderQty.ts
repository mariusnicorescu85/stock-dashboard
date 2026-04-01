/**
 * Reorder quantity: bring effective stock up to a target that covers
 * supplier lead time plus an extra "buffer" of selling days (safety stock).
 *
 * targetUnits = (leadTimeDays + coverBufferDays) × dailyDemand
 * rawQty = max(0, ⌈targetUnits − effectiveStock⌉)
 * then optional MOQ + pack rounding from Airtable (see applySupplierOrderConstraints).
 */
export const DEFAULT_COVER_BUFFER_DAYS = 30;

export function coverBufferDaysFromEnv(): number {
  const raw = process.env.STOCK_COVER_BUFFER_DAYS?.trim();
  if (raw == null || raw === "") return DEFAULT_COVER_BUFFER_DAYS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_COVER_BUFFER_DAYS;
  return Math.floor(n);
}

/** Raw units needed before MOQ / case rounding (same as previous app behaviour). */
export function computeRawQtyToOrder(
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

  const lead =
    p.leadTimeDays != null && Number.isFinite(p.leadTimeDays)
      ? Math.max(0, p.leadTimeDays)
      : 0;
  const targetUnits = (lead + coverBufferDays) * p.dailyDemand;
  const gap = targetUnits - p.effectiveStock;
  if (gap <= 0) return 0;
  return Math.ceil(gap);
}

/**
 * After the demand-based raw qty: enforce minimum order qty, then round up to full packs/cases.
 * moq / packSize ≤ 1 or missing → treated as 1 (no extra constraint).
 */
export function applySupplierOrderConstraints(
  rawQty: number,
  moq: number | null | undefined,
  packSize: number | null | undefined
): number {
  if (rawQty <= 0) return 0;

  const m = Number(moq);
  const moqEff = Number.isFinite(m) && m > 0 ? Math.floor(m) : 1;

  const packNum = Number(packSize);
  const packEff =
    Number.isFinite(packNum) && packNum > 1 ? Math.floor(packNum) : 1;

  let q = Math.max(rawQty, moqEff);
  if (packEff > 1) {
    q = Math.ceil(q / packEff) * packEff;
  }
  return q;
}

export function computeQtyToOrder(
  p: {
    effectiveStock: number;
    dailyDemand: number;
    leadTimeDays: number | null;
    excludeFromReorder: boolean;
    orderMoq?: number | null;
    orderPackSize?: number | null;
  },
  coverBufferDays = DEFAULT_COVER_BUFFER_DAYS
): number {
  const raw = computeRawQtyToOrder(p, coverBufferDays);
  return applySupplierOrderConstraints(raw, p.orderMoq, p.orderPackSize);
}
