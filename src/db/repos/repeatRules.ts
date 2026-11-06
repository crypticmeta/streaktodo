import { getDb } from '../client';
import { emit } from '../events';
import { newId } from '../ids';
import { now } from '../time';
import { repeatRuleFromRow, type RepeatRule, type RepeatFrequency } from '../schema';
import {
  dateKeyFromTimestamp,
  isCalendarDate,
  timestampFromDateKey,
  type CalendarDate,
} from '../../lib/date';
import { queryChunks } from '../query';

// One repeat rule per task (UNIQUE constraint in schema). Use upsert helper
// below — there's no need for the UI to track whether a rule existed before.

export type RepeatRuleInput = {
  freq: RepeatFrequency;
  intervalN?: number;
  byWeekday?: string | null;       // 'MO,WE,FR'
  byMonthDay?: number | null;
  byMonth?: number | null;
  untilAt?: number | null;
  anchorDate?: CalendarDate | null;
  untilDate?: CalendarDate | null;
};

export async function getRepeatRuleByTask(taskId: string): Promise<RepeatRule | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<unknown>(
    `SELECT * FROM task_repeat_rules WHERE task_id = ? AND deleted_at IS NULL`,
    [taskId]
  );
  return row ? repeatRuleFromRow(row) : null;
}

// Insert if missing, update in place if present. Returns the resulting rule.
export async function upsertRepeatRule(taskId: string, input: RepeatRuleInput): Promise<RepeatRule> {
  const db = await getDb();
  const ts = now();
  const task = await db.getFirstAsync<{ due_date: CalendarDate | null }>(
    `SELECT due_date FROM tasks WHERE id = ? AND deleted_at IS NULL`,
    [taskId]
  );
  if (!task) throw new Error('Task no longer exists.');
  if (!task.due_date) throw new Error('Choose a date before adding a repeat rule.');
  const existing = await db.getFirstAsync<{ anchor_date: CalendarDate | null }>(
    `SELECT anchor_date FROM task_repeat_rules WHERE task_id = ?`,
    [taskId]
  );
  const intervalN = input.intervalN ?? 1;
  if (!Number.isInteger(intervalN) || intervalN < 1 || intervalN > 999) {
    throw new Error('Repeat interval must be between 1 and 999.');
  }
  const anchorDate = input.anchorDate !== undefined
    ? input.anchorDate
    : existing?.anchor_date ?? task.due_date;
  const untilDate = input.untilDate !== undefined
    ? input.untilDate
    : input.untilAt == null
      ? null
      : dateKeyFromTimestamp(input.untilAt);
  if (anchorDate !== null && !isCalendarDate(anchorDate)) {
    throw new Error('Choose a valid repeat start date.');
  }
  if (untilDate !== null && !isCalendarDate(untilDate)) {
    throw new Error('Choose a valid repeat end date.');
  }
  if (input.byWeekday !== undefined && input.byWeekday !== null &&
    !/^(SU|MO|TU|WE|TH|FR|SA)(,(SU|MO|TU|WE|TH|FR|SA))*$/.test(input.byWeekday)) {
    throw new Error('Choose valid repeat weekdays.');
  }
  if (input.byMonthDay !== undefined && input.byMonthDay !== null &&
    (!Number.isInteger(input.byMonthDay) || input.byMonthDay < 1 || input.byMonthDay > 31)) {
    throw new Error('Choose a valid day of the month.');
  }
  if (input.byMonth !== undefined && input.byMonth !== null &&
    (!Number.isInteger(input.byMonth) || input.byMonth < 1 || input.byMonth > 12)) {
    throw new Error('Choose a valid month.');
  }
  if (untilDate && anchorDate && untilDate < anchorDate) {
    throw new Error('Repeat end date cannot be before its start date.');
  }

  await db.runAsync(
    `INSERT INTO task_repeat_rules
       (id, task_id, freq, interval_n, by_weekday, by_month_day, by_month,
        until_at, anchor_date, until_date, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(task_id) DO UPDATE SET
       freq = excluded.freq,
       interval_n = excluded.interval_n,
       by_weekday = excluded.by_weekday,
       by_month_day = excluded.by_month_day,
       by_month = excluded.by_month,
       until_at = excluded.until_at,
       anchor_date = excluded.anchor_date,
       until_date = excluded.until_date,
       updated_at = excluded.updated_at,
       deleted_at = NULL`,
    [
      newId(),
      taskId,
      input.freq,
      intervalN,
      input.byWeekday ?? null,
      input.byMonthDay ?? null,
      input.byMonth ?? null,
      untilDate ? timestampFromDateKey(untilDate) : null,
      anchorDate,
      untilDate,
      ts,
      ts,
    ]
  );
  const created = await getRepeatRuleByTask(taskId);
  if (!created) throw new Error('Repeat rule insert succeeded but row not found');
  emit('tasks-changed');
  return created;
}

export async function softDeleteRepeatRule(taskId: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.runAsync(
    `UPDATE task_repeat_rules SET deleted_at = ?, updated_at = ?
      WHERE task_id = ? AND deleted_at IS NULL`,
    [ts, ts, taskId]
  );
  emit('tasks-changed');
}

// Set of task ids that currently have an active repeat rule.
export async function taskIdsWithRepeat(taskIds: string[]): Promise<Set<string>> {
  if (taskIds.length === 0) return new Set();
  const db = await getDb();
  const out = new Set<string>();
  for (const chunk of queryChunks(taskIds)) {
    const placeholders = chunk.map(() => '?').join(',');
    const rows = await db.getAllAsync<{ task_id: string }>(
      `SELECT task_id FROM task_repeat_rules
        WHERE deleted_at IS NULL AND task_id IN (${placeholders})`,
      chunk
    );
    for (const row of rows) out.add(row.task_id);
  }
  return out;
}
