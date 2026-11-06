/**
 * Recurrence math.
 *
 * Pure helpers — no DB, no side effects. Each function takes a repeat rule
 * shape (the same fields the DB stores) and a "from" timestamp, and returns
 * the next occurrence as a start-of-day epoch ms. Returns null when the
 * recurrence has run out (until_at exceeded).
 */

import { addDays, addMonths, startOfDay } from './date';

export type RepeatFreqInput = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export type RepeatRuleInput = {
  freq: RepeatFreqInput;
  intervalN: number;            // every N units; clamped >= 1 internally
  byWeekday: string | null;     // CSV like "MO,WE,FR"; null = derive from anchor
  byMonthDay: number | null;    // 1..31; null = use anchor's day
  byMonth: number | null;       // 1..12 (yearly); null = use anchor's month
  untilAt: number | null;       // last allowed start-of-day, inclusive
  /** Stable first occurrence. Required for interval-based weekly rules. */
  anchorAt?: number | null;
};

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
type WeekdayCode = (typeof WEEKDAY_CODES)[number];

function parseWeekdays(csv: string | null): number[] {
  if (!csv) return [];
  const set = new Set<number>();
  for (const part of csv.split(',')) {
    const idx = WEEKDAY_CODES.indexOf(part.trim() as WeekdayCode);
    if (idx >= 0) set.add(idx);
  }
  return [...set].sort((a, b) => a - b);
}

function clampInterval(n: number): number {
  return n >= 1 ? Math.floor(n) : 1;
}

function calendarDayNumber(ts: number): number {
  const d = new Date(ts);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

function weekStart(ts: number): number {
  const day = startOfDay(ts);
  return addDays(day, -new Date(day).getDay());
}

/**
 * Compute the next occurrence strictly AFTER `fromTs`. Returns null if the
 * computed date is past `untilAt`, or if the rule produces no future date.
 *
 * The returned timestamp is at start-of-day local; callers preserve the
 * original task's dueTime separately.
 */
export function nextOccurrence(
  rule: RepeatRuleInput,
  fromTs: number = Date.now()
): number | null {
  const interval = clampInterval(rule.intervalN);
  const fromDay = startOfDay(fromTs);

  let next: number;

  switch (rule.freq) {
    case 'daily':
      next = addDays(fromDay, interval);
      break;

    case 'weekly': {
      const weekdays = parseWeekdays(rule.byWeekday);
      if (weekdays.length === 0) {
        // No specific weekdays — stride forward by intervalN weeks.
        next = addDays(fromDay, interval * 7);
        break;
      }
      const anchorWeek = weekStart(rule.anchorAt ?? fromDay);
      let candidate: number | null = null;
      // One full cadence plus a week always contains the next selected day.
      for (let delta = 1; delta <= interval * 7 + 7; delta += 1) {
        const day = addDays(fromDay, delta);
        if (!weekdays.includes(new Date(day).getDay())) continue;
        const weekIndex = Math.floor(
          (calendarDayNumber(weekStart(day)) - calendarDayNumber(anchorWeek)) / 7
        );
        if (weekIndex >= 0 && weekIndex % interval === 0) {
          candidate = day;
          break;
        }
      }
      if (candidate === null) return null;
      next = candidate;
      break;
    }

    case 'monthly': {
      // Stride by intervalN months. If byMonthDay is set, use it; otherwise
      // preserve the from-date's day. addMonths clamps to month length.
      const stepped = addMonths(fromDay, interval);
      const targetDay = rule.byMonthDay ?? new Date(fromDay).getDate();
      const d = new Date(stepped);
      // Clamp to the actual month length so e.g. Jan 31 → Feb 28.
      const lastOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(targetDay, lastOfMonth));
      d.setHours(0, 0, 0, 0);
      next = d.getTime();
      break;
    }

    case 'yearly': {
      const stepped = addMonths(fromDay, interval * 12);
      const d = new Date(stepped);
      if (rule.byMonth !== null) {
        // by_month is 1..12; setMonth wants 0..11.
        d.setMonth(rule.byMonth - 1);
      }
      const lastOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const targetDay = rule.byMonthDay ?? new Date(fromDay).getDate();
      d.setDate(Math.min(targetDay, lastOfMonth));
      d.setHours(0, 0, 0, 0);
      next = d.getTime();
      break;
    }

    case 'custom': {
      // A custom rule still rides one of the four standard frequency units
      // underneath. The editor ensures byWeekday / byMonthDay / byMonth are
      // populated correctly for the chosen unit. We default to weekly when
      // we somehow lost that information so the runtime always produces
      // something valid (matches the legacy V0 behaviour).
      const byWeekdays = parseWeekdays(rule.byWeekday);
      const underlying: RepeatFreqInput = byWeekdays.length > 0
        ? 'weekly'
        : rule.byMonth !== null
          ? 'yearly'
          : rule.byMonthDay !== null
            ? 'monthly'
            : 'daily';
      return nextOccurrence({ ...rule, freq: underlying }, fromTs);
    }
  }

  if (rule.untilAt !== null && next > rule.untilAt) return null;
  return next;
}
