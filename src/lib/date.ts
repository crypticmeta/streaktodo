// Pure date helpers. All times work in the device's LOCAL timezone — task
// due-dates are calendar-day concepts ("due tomorrow"), not absolute instants.
// Stored as epoch ms at 00:00 local on the due day.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Returns 00:00:00.000 local time for the given timestamp. */
export function startOfDay(ts: number = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Add n calendar days (DST-safe via Date arithmetic, not raw ms). */
export function addDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/**
 * Returns the next occurrence of the given weekday (0 = Sunday, 6 = Saturday).
 * If today is the target weekday, returns next week's occurrence (so "This
 * Sunday" tapped on a Sunday means the upcoming Sunday, not today).
 */
export function nextWeekday(weekday: number, fromTs: number = Date.now()): number {
  const start = startOfDay(fromTs);
  const today = new Date(start).getDay();
  const delta = ((weekday - today + 7) % 7) || 7;
  return addDays(start, delta);
}

/**
 * Day diff between two timestamps, normalized to start-of-day so DST and
 * partial-day differences don't produce -0.5 day weirdness.
 *   formatRelativeShort(today) -> 'Today'
 *   formatRelativeShort(today + 1d) -> 'Tomorrow'
 *   formatRelativeShort(today - 1d) -> 'Yesterday'
 *   formatRelativeShort(today + 5d) -> 'Sat' (within next 6 days)
 *   formatRelativeShort(beyond)     -> '12 May'
 */
export function formatRelativeShort(ts: number, nowTs: number = Date.now()): string {
  const target = startOfDay(ts);
  const today = startOfDay(nowTs);
  const diffDays = Math.round((target - today) / MS_PER_DAY);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';

  const d = new Date(target);
  if (diffDays > 1 && diffDays <= 6) {
    // Within next week — render the weekday name.
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  }

  const sameYear = d.getFullYear() === new Date(today).getFullYear();
  return d.toLocaleDateString(
    undefined,
    sameYear
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' }
  );
}

/** True if the date is strictly before today (used for overdue styling later). */
export function isOverdue(ts: number, nowTs: number = Date.now()): boolean {
  return startOfDay(ts) < startOfDay(nowTs);
}

export const Weekday = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
} as const;

/** First-of-month at 00:00 local. */
export function startOfMonth(ts: number = Date.now()): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Number of days in the month containing ts. */
export function daysInMonth(ts: number = Date.now()): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Add n calendar months (clamps day if target month is shorter). */
export function addMonths(ts: number, n: number): number {
  const d = new Date(ts);
  const targetMonth = d.getMonth() + n;
  d.setDate(1);
  d.setMonth(targetMonth);
  return d.getTime();
}

/** Same calendar day? Compares local-time start-of-day. */
export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

/** Format a time stored as minutes-since-midnight in the user's locale. */
export function formatTimeFromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "12 May 2026" style; used for compact metadata where the year matters. */
export function formatLongDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "27th" style ordinal suffix for the day-of-month. Used in repeat labels. */
export function formatDayOfMonthOrdinal(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;
export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;
