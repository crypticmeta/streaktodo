/**
 * Streak + dashboard statistics.
 *
 * Pure functions. Take a snapshot of all tasks, return numbers and arrays
 * the dashboard renders. Day-bucket logic is shared with `taskGrouping.ts`
 * but the questions are different here ("did this DAY have a completion?")
 * so the math lives separately.
 *
 * Honest by construction:
 * - A streak day requires at least one task completed for that day.
 * - A missed day is a day with at least one due task and zero completions.
 * - A blank day (no tasks due, no completions) is neither — the streak
 *   continues across rest days. This is the "honest" interpretation per
 *   the design system: we don't fake-streak you for days you weren't
 *   trying, and we don't fake-break you for days nothing was scheduled.
 */

import type { Task } from '../db';
import { addDays, startOfDay } from './date';

type DayState = 'completed' | 'pending' | 'missed' | 'blank';

export type DayActivity = {
  /** Local calendar-day start timestamp. */
  ts: number;
  due: number;
  completed: number;
};

/** Compact task history used by both the pure helpers and SQL-backed Insights. */
export function summarizeTaskDays(tasks: ReadonlyArray<Task>): DayActivity[] {
  const totals = new Map<number, { due: number; completed: number }>();
  for (const task of tasks) {
    if (task.dueAt !== null) {
      const day = startOfDay(task.dueAt);
      const slot = totals.get(day) ?? { due: 0, completed: 0 };
      slot.due += 1;
      totals.set(day, slot);
    }
    if (task.status === 'done' && task.completedAt !== null) {
      const day = startOfDay(task.completedAt);
      const slot = totals.get(day) ?? { due: 0, completed: 0 };
      slot.completed += 1;
      totals.set(day, slot);
    }
  }
  return [...totals.entries()].map(([ts, counts]) => ({ ts, ...counts }));
}

/**
 * For each day in the user's task history, classify it:
 *   - completed: at least one task was finished that day
 *   - missed:    at least one task was due that day, with no completion
 *   - blank:     no task was due or completed that day
 *
 * Returns a Map keyed by start-of-day epoch ms. Only days that have at
 * least one TASK (completed OR pending OR skipped, with a dueAt) appear in
 * the map. Days with no due-anything are absent.
 */
function classifyDays(
  activity: ReadonlyArray<DayActivity>,
  today: number
): { states: Map<number, DayState>; dueDays: Set<number> } {
  const out = new Map<number, DayState>();
  const dueDays = new Set<number>();
  for (const row of activity) {
    const day = startOfDay(row.ts);
    if (row.due > 0) dueDays.add(day);
    if (row.completed > 0) out.set(day, 'completed');
    else if (row.due > 0) {
      out.set(day, day < today ? 'missed' : 'pending');
    } else out.set(day, 'blank');
  }
  return { states: out, dueDays };
}

export type StreakStats = {
  /** Length of the consecutive streak ending today (or 0 if neither today
   *  nor yesterday counts). Today counts if it's completed; if today is
   *  blank or pending, the streak holds at the most recent completed day. */
  current: number;
  /** Longest run ever observed in the user's history. */
  best: number;
  /** Whether today is already a completed day (for ring fill state). */
  todayCompleted: boolean;
  /** Whether today has any task due (for "today pending" vs "no streak"). */
  todayHasDueTask: boolean;
  /** Misses in the current calendar month. */
  missedThisMonth: number;
};

export function computeStreakStats(
  tasks: ReadonlyArray<Task>,
  nowTs: number = Date.now()
): StreakStats {
  return computeStreakStatsFromActivity(summarizeTaskDays(tasks), nowTs);
}

export function computeStreakStatsFromActivity(
  activity: ReadonlyArray<DayActivity>,
  nowTs: number = Date.now()
): StreakStats {
  const today = startOfDay(nowTs);
  const { states: days, dueDays } = classifyDays(activity, today);

  // Walk backwards from today to find the current streak length.
  // A 'completed' day continues the streak. A 'blank' day is also continuing
  // (rest day). A 'missed' day breaks it. Today specifically: if today is
  // 'completed', the streak includes it; otherwise we start counting from
  // yesterday.
  let cursor = today;
  let current = 0;
  if (days.get(today) === 'completed') {
    current = 1;
    cursor = addDays(today, -1);
  } else {
    // Pending or blank today holds the streak until the day ends.
    cursor = addDays(today, -1);
  }

  while (true) {
    const state = days.get(cursor);
    if (state === 'completed') {
      current += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    if (state === 'blank' || state === undefined) {
      // Don't extend the streak across blank gaps — but only stop if we
      // reach a missed day OR run out of history. To avoid an infinite
      // loop on undefined-only history, stop when there are no entries
      // earlier than `cursor`.
      const earliest = oldestEntry(days);
      if (earliest === null || cursor < earliest) break;
      cursor = addDays(cursor, -1);
      continue;
    }
    // 'missed' breaks the streak.
    break;
  }

  // Best streak — scan all days, count consecutive completed runs (treating
  // blanks as continuing per the rule above, missed as breaking).
  const sortedDays = [...days.keys()].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (const day of sortedDays) {
    const state = days.get(day)!;
    if (state === 'completed') {
      run += 1;
      if (run > best) best = run;
    } else if (state === 'missed') {
      run = 0;
    }
  }

  // Missed-this-month — count missed days whose date is in the current month.
  const monthStart = (() => {
    const d = new Date(today);
    d.setDate(1);
    return d.getTime();
  })();
  let missedThisMonth = 0;
  for (const [day, state] of days) {
    if (state !== 'missed') continue;
    if (day < monthStart) continue;
    if (day > today) continue;
    missedThisMonth += 1;
  }

  return {
    current,
    best,
    todayCompleted: days.get(today) === 'completed',
    todayHasDueTask: dueDays.has(today),
    missedThisMonth,
  };
}

function oldestEntry(map: Map<number, DayState>): number | null {
  let oldest: number | null = null;
  for (const day of map.keys()) {
    if (oldest === null || day < oldest) oldest = day;
  }
  return oldest;
}

// ─── Weekly completion (last 7 days, ending today) ─────────────────────

export type WeeklyBar = {
  /** start-of-day epoch ms */
  ts: number;
  /** Mon / Tue / … weekday letter for the axis label */
  shortLabel: string;
  /** how many tasks completed that day */
  completed: number;
  /** how many tasks were due that day (denominator) */
  total: number;
  isToday: boolean;
  isUpcoming: boolean;
};

const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/**
 * Last 7 days ending at today (today is the rightmost bar). For each day:
 * count of tasks due that day and count completed.
 */
export function computeWeeklyCompletion(
  tasks: ReadonlyArray<Task>,
  nowTs: number = Date.now()
): WeeklyBar[] {
  return computeWeeklyCompletionFromActivity(summarizeTaskDays(tasks), nowTs);
}

export function computeWeeklyCompletionFromActivity(
  activity: ReadonlyArray<DayActivity>,
  nowTs: number = Date.now()
): WeeklyBar[] {
  const today = startOfDay(nowTs);
  const totals = new Map(activity.map((row) => [
    startOfDay(row.ts),
    { total: row.due, done: row.completed },
  ]));

  const bars: WeeklyBar[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = addDays(today, -i);
    const slot = totals.get(day) ?? { total: 0, done: 0 };
    const weekday = new Date(day).getDay();
    bars.push({
      ts: day,
      shortLabel: WEEKDAY_LETTER[weekday]!,
      completed: slot.done,
      total: slot.total,
      isToday: day === today,
      isUpcoming: day > today,
    });
  }
  return bars;
}

// ─── Overview totals ───────────────────────────────────────────────────

export type OverviewTotals = {
  /** All non-deleted tasks. */
  total: number;
  /** Status === 'done'. */
  done: number;
  /** Status === 'pending' (skipped is excluded — not actionable, not done). */
  pending: number;
  /** Pending tasks whose dueAt is before today's start-of-day. */
  overdue: number;
};

/**
 * Counts across the user's full task list. Used by the Insights dashboard's
 * overview card. Excludes soft-deleted rows (caller is expected to pass
 * non-deleted tasks via useTasks, but we filter defensively).
 */
export function computeOverviewTotals(
  tasks: ReadonlyArray<Task>,
  nowTs: number = Date.now()
): OverviewTotals {
  const today = startOfDay(nowTs);
  let total = 0;
  let done = 0;
  let pending = 0;
  let overdue = 0;

  for (const t of tasks) {
    if (t.deletedAt !== null) continue;
    total += 1;
    if (t.status === 'done') {
      done += 1;
    } else if (t.status === 'pending') {
      pending += 1;
      if (t.dueAt !== null && t.dueAt < today) overdue += 1;
    }
  }

  return { total, done, pending, overdue };
}

// ─── Upcoming 7 days (forward-looking) ─────────────────────────────────

export type UpcomingDay = {
  /** start-of-day epoch ms */
  ts: number;
  /** Mon / Tue / … weekday letter */
  shortLabel: string;
  /** "Tomorrow" / "Mon 5" / etc — caller's choice; we provide a default. */
  longLabel: string;
  /** Pending (non-done, non-deleted) tasks due that day. */
  pending: number;
  isTomorrow: boolean;
};

const WEEKDAY_LONG = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Forward-looking peek at the next 7 days starting from tomorrow. For each
 * day, count of pending tasks whose dueAt falls on that day. Distinct from
 * `computeWeeklyCompletion` which looks at the last 7 days retrospectively.
 *
 * Why pending only: a "next 7 days" view is about what's coming up, not what
 * has already been done. A task already completed for a future date (rare,
 * but possible via the editor) shouldn't appear as workload.
 */
export function computeUpcomingWeek(
  tasks: ReadonlyArray<Task>,
  nowTs: number = Date.now()
): UpcomingDay[] {
  const today = startOfDay(nowTs);
  const counts = new Map<number, number>();

  for (const t of tasks) {
    if (t.deletedAt !== null) continue;
    if (t.status !== 'pending') continue;
    if (t.dueAt === null) continue;
    const day = startOfDay(t.dueAt);
    if (day <= today) continue; // strictly future
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  return computeUpcomingWeekFromCounts(counts, nowTs);
}

export function computeUpcomingWeekFromCounts(
  counts: ReadonlyMap<number, number>,
  nowTs: number = Date.now()
): UpcomingDay[] {
  const today = startOfDay(nowTs);
  const days: UpcomingDay[] = [];
  for (let i = 1; i <= 7; i++) {
    const day = addDays(today, i);
    const d = new Date(day);
    const weekday = d.getDay();
    const dayOfMonth = d.getDate();
    days.push({
      ts: day,
      shortLabel: WEEKDAY_LETTER[weekday]!,
      longLabel: i === 1 ? 'Tomorrow' : `${WEEKDAY_LONG[weekday]} ${dayOfMonth}`,
      pending: counts.get(day) ?? 0,
      isTomorrow: i === 1,
    });
  }
  return days;
}

// ─── Category breakdown ────────────────────────────────────────────────

export type CategorySlice = {
  categoryId: string | null; // null = uncategorized
  count: number;
};

/**
 * Counts of non-deleted tasks (any status) per category over a window.
 * Default window: all-time. Uncategorized tasks are bucketed under
 * categoryId === null.
 */
export function computeCategoryBreakdown(
  tasks: ReadonlyArray<Task>,
  windowStart: number | null = null
): CategorySlice[] {
  const counts = new Map<string | null, number>();
  for (const t of tasks) {
    if (windowStart !== null && t.createdAt < windowStart) continue;
    const key = t.categoryId ?? null;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([categoryId, count]) => ({ categoryId, count }))
    .sort((a, b) => b.count - a.count);
}
