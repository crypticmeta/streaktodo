import { describe, expect, it } from 'vitest';
import type { Task } from '../../db/schema';
import {
  computeStreakStats,
  computeStreakStatsFromActivity,
  computeWeeklyCompletion,
  computeWeeklyCompletionFromActivity,
  summarizeTaskDays,
} from '../streakStats';

const day = (year: number, month: number, date: number, hour = 0) =>
  new Date(year, month, date, hour).getTime();

function task(patch: Partial<Task>): Task {
  return {
    id: patch.id ?? crypto.randomUUID(),
    title: 'Task', notes: null, categoryId: null,
    dueAt: null, dueDate: null, dueTime: null,
    status: 'pending', isPinned: false, completedAt: null,
    sortOrder: 0, createdAt: 1, updatedAt: 1, deletedAt: null,
    seriesId: null, parentOccurrenceId: null,
    ...patch,
  };
}

describe('streak statistics', () => {
  it('does not mark today missed while the day is still in progress', () => {
    const now = day(2026, 7, 11, 12);
    const stats = computeStreakStats([
      task({ dueAt: day(2026, 7, 10), status: 'done', completedAt: day(2026, 7, 10, 9) }),
      task({ dueAt: day(2026, 7, 11), status: 'pending' }),
    ], now);
    expect(stats.current).toBe(1);
    expect(stats.missedThisMonth).toBe(0);
    expect(stats.todayHasDueTask).toBe(true);
    expect(stats.todayCompleted).toBe(false);
  });

  it('counts completion activity on completedAt, not the due date', () => {
    const bars = computeWeeklyCompletion([
      task({ dueAt: day(2026, 7, 9), status: 'done', completedAt: day(2026, 7, 10, 10) }),
    ], day(2026, 7, 11, 12));
    const dueDay = bars.find((bar) => bar.ts === day(2026, 7, 9));
    const completionDay = bars.find((bar) => bar.ts === day(2026, 7, 10));
    expect(dueDay).toMatchObject({ total: 1, completed: 0 });
    expect(completionDay).toMatchObject({ total: 0, completed: 1 });
  });

  it('marks only past scheduled days as missed', () => {
    const stats = computeStreakStats([
      task({ dueAt: day(2026, 7, 10), status: 'pending' }),
      task({ dueAt: day(2026, 7, 11), status: 'pending' }),
    ], day(2026, 7, 11, 12));
    expect(stats.missedThisMonth).toBe(1);
  });

  it('produces the same dashboard result from compact SQL-style day aggregates', () => {
    const now = day(2026, 7, 11, 12);
    const tasks = [
      task({ dueAt: day(2026, 7, 9), status: 'done', completedAt: day(2026, 7, 10, 10) }),
      task({ dueAt: day(2026, 7, 10), status: 'done', completedAt: day(2026, 7, 10, 15) }),
      task({ dueAt: day(2026, 7, 11), status: 'pending' }),
    ];
    const activity = summarizeTaskDays(tasks);
    expect(computeStreakStatsFromActivity(activity, now)).toEqual(
      computeStreakStats(tasks, now)
    );
    expect(computeWeeklyCompletionFromActivity(activity, now)).toEqual(
      computeWeeklyCompletion(tasks, now)
    );
  });
});
