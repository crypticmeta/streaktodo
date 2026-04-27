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
