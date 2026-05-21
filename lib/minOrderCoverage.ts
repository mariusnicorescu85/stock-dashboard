import { applySupplierOrderConstraints } from "./reorderQty";

/**
 * Smallest order chunk allowed by supplier minimum order qty + case rounding.
 * Mirrors how `computeQtyToOrder` behaves when raw need would be trivially small (uses raw 1 unit).
 */
export function minimumOrderableChunkUnits(
  orderMoq: number | null | undefined,
  orderPackSize: number | null | undefined
): number {
  return applySupplierOrderConstraints(1, orderMoq, orderPackSize);
}

/** Days of cover after adding exactly one minimal MOQ–pack-shaped chunk (simplified: stock arrives overnight). */
export function daysCoverageWithMinOrderChunk(
  effectiveStock: number,
  dailyDemand: number,
  orderMoq: number | null | undefined,
  orderPackSize: number | null | undefined
): number | null {
  if (!(dailyDemand > 0) || !Number.isFinite(effectiveStock)) return null;
  const chunk = minimumOrderableChunkUnits(orderMoq, orderPackSize);
  if (!(chunk > 0)) return null;
  return (effectiveStock + chunk) / dailyDemand;
}
