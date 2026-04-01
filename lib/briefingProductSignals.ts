import type { BriefingTopReorder } from "./stockBriefing";

/** True when Airtable “briefing snooze” is still in effect (date ≥ today). */
export function isBriefingSnoozeActive(
  snoozeUntilYmd: string | null | undefined,
  todayYmd: string
): boolean {
  if (snoozeUntilYmd == null || snoozeUntilYmd === "") return false;
  return snoozeUntilYmd >= todayYmd;
}

export function reorderRowIsBriefingSnoozed(row: BriefingTopReorder, todayYmd: string): boolean {
  return isBriefingSnoozeActive(row.briefingSnoozeUntil, todayYmd);
}
