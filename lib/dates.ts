import { differenceInCalendarDays, getISOWeek, getISOWeekYear, parseISO } from "date-fns";

export function programWeekNumber(startDateStr: string, ref = new Date()): number {
  const start = parseISO(startDateStr);
  const days = differenceInCalendarDays(ref, start);
  if (days < 0) return 1;
  const week = Math.floor(days / 7) + 1;
  return Math.min(11, Math.max(1, week));
}

export function isoWeekKey(d: Date): string {
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
}
