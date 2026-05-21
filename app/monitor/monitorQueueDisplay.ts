import type { MonitorPressureTone } from "@/lib/monitorPressureTier";

export function monitorQueueFormatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB");
}

export function monitorQueueTierTextClass(tone: MonitorPressureTone): string {
  switch (tone) {
    case "critical":
      return "text-red-300";
    case "urgent":
      return "text-amber-300/95";
    case "watch":
      return "text-sky-400/95";
    case "plan":
      return "text-slate-400";
    case "cover":
      return "text-emerald-400/90";
    default:
      return "text-slate-500";
  }
}

export function monitorQueueDaysText(days: number | null): string {
  if (days == null) return "—";
  const n = Math.max(0, Math.round(days));
  return `${n}d`;
}

export function monitorQueueDaysMutedClass(days: number | null): string {
  if (days == null) return "text-slate-500";
  const n = Math.max(0, Math.round(days));
  if (n <= 7) return "font-semibold text-red-300 tabular-nums";
  if (n <= 30) return "font-medium text-amber-200/90 tabular-nums";
  return "text-slate-300 tabular-nums";
}
