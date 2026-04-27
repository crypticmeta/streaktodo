import { getDb } from '../client';
import { newId } from '../ids';
import { now } from '../time';
import { repeatRuleFromRow, type RepeatRule, type RepeatFrequency } from '../schema';

// One repeat rule per task (UNIQUE constraint in schema). Use upsert helper
// below — there's no need for the UI to track whether a rule existed before.

export type RepeatRuleInput = {
  freq: RepeatFrequency;
  intervalN?: number;
  byWeekday?: string | null;       // 'MO,WE,FR'
  byMonthDay?: number | null;
  byMonth?: number | null;
  untilAt?: number | null;
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
  const existing = await getRepeatRuleByTask(taskId);
  const db = await getDb();
  const ts = now();

  if (existing) {
    await db.runAsync(
      `UPDATE task_repeat_rules
         SET freq = ?, interval_n = ?, by_weekday = ?, by_month_day = ?, by_month = ?, until_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.freq,
        input.intervalN ?? 1,
        input.byWeekday ?? null,
        input.byMonthDay ?? null,
        input.byMonth ?? null,
        input.untilAt ?? null,
        ts,
        existing.id,
      ]
    );
    const updated = await getRepeatRuleByTask(taskId);
    if (!updated) throw new Error('Repeat rule update succeeded but row not found');
    return updated;
  }

  const id = newId();
  await db.runAsync(
    `INSERT INTO task_repeat_rules
       (id, task_id, freq, interval_n, by_weekday, by_month_day, by_month, until_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      taskId,
      input.freq,
      input.intervalN ?? 1,
      input.byWeekday ?? null,
      input.byMonthDay ?? null,
      input.byMonth ?? null,
      input.untilAt ?? null,
      ts,
      ts,
    ]
  );
  const created = await getRepeatRuleByTask(taskId);
  if (!created) throw new Error('Repeat rule insert succeeded but row not found');
  return created;
}

export async function softDeleteRepeatRule(taskId: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.runAsync(
    `UPDATE task_repeat_rules SET deleted_at = ?, updated_at = ? WHERE task_id = ?`,
    [ts, ts, taskId]
  );
}

// Set of task ids that currently have an active repeat rule.
export async function taskIdsWithRepeat(taskIds: string[]): Promise<Set<string>> {
  if (taskIds.length === 0) return new Set();
  const db = await getDb();
  const placeholders = taskIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ task_id: string }>(
    `SELECT task_id FROM task_repeat_rules
      WHERE deleted_at IS NULL AND task_id IN (${placeholders})`,
    taskIds
  );
  return new Set(rows.map((r) => r.task_id));
}
