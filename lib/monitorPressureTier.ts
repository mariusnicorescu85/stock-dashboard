/**
 * Urgency band aligned with `partitionRunoutBuckets` thresholds, plus a tail band for replenish-only lines.
 */

export type MonitorPressureTone =
  | "critical"
  | "urgent"
  | "watch"
  | "plan"
  | "cover"
  | "unknown";

export function monitorPressureLabel(daysUntilRunOut: number | null): {
  tone: MonitorPressureTone;
  label: string;
} {
  if (daysUntilRunOut == null || !Number.isFinite(daysUntilRunOut)) {
    return { tone: "unknown", label: "No sales pace" };
  }
  if (daysUntilRunOut < 0) {
    return { tone: "critical", label: "Already drained (model)" };
  }
  if (daysUntilRunOut <= 7) return { tone: "critical", label: "~1 week or less left" };
  if (daysUntilRunOut <= 14) return { tone: "urgent", label: "~1–2 weeks left" };
  if (daysUntilRunOut <= 30) return { tone: "watch", label: "~2–4 weeks left" };
  if (daysUntilRunOut <= 60) return { tone: "plan", label: "~5–8 weeks left" };
  return { tone: "cover", label: ">8 weeks · reorder for safety stock" };
}
