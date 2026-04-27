import { getDb } from '../client';
import { newId } from '../ids';
import { now } from '../time';
import { reminderFromRow, type Reminder, type ReminderType } from '../schema';

export type CreateReminderInput = {
  taskId: string;
  leadMinutes: number;            // 0 = at time of task
  type?: ReminderType;            // default 'notification'
};

export type UpdateReminderInput = {
  leadMinutes?: number;
  type?: ReminderType;
  scheduledNotificationId?: string | null;
};

export async function listRemindersByTask(taskId: string): Promise<Reminder[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<unknown>(
    `SELECT * FROM task_reminders
       WHERE task_id = ? AND deleted_at IS NULL
       ORDER BY lead_minutes DESC, created_at ASC`,
    [taskId]
  );
  return rows.map(reminderFromRow);
}

export async function getReminderById(id: string): Promise<Reminder | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<unknown>(
    `SELECT * FROM task_reminders WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return row ? reminderFromRow(row) : null;
}

export async function createReminder(input: CreateReminderInput): Promise<Reminder> {
  const db = await getDb();
  const id = newId();
  const ts = now();
  await db.runAsync(
    `INSERT INTO task_reminders
       (id, task_id, lead_minutes, type, scheduled_notification_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    [id, input.taskId, input.leadMinutes, input.type ?? 'notification', ts, ts]
  );
  const created = await getReminderById(id);
  if (!created) throw new Error('Reminder insert succeeded but row not found');
  return created;
}

export async function updateReminder(id: string, patch: UpdateReminderInput): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if (patch.leadMinutes !== undefined) {
    sets.push('lead_minutes = ?');
    args.push(patch.leadMinutes);
  }
  if (patch.type !== undefined) {
    sets.push('type = ?');
    args.push(patch.type);
  }
  if (patch.scheduledNotificationId !== undefined) {
    sets.push('scheduled_notification_id = ?');
    args.push(patch.scheduledNotificationId);
  }

  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  args.push(now());
  args.push(id);

  await db.runAsync(`UPDATE task_reminders SET ${sets.join(', ')} WHERE id = ?`, args);
}

export async function softDeleteReminder(id: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.runAsync(
    `UPDATE task_reminders SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [ts, ts, id]
  );
}

// Set of task ids that currently have at least one active reminder.
export async function taskIdsWithReminders(taskIds: string[]): Promise<Set<string>> {
  if (taskIds.length === 0) return new Set();
  const db = await getDb();
  const placeholders = taskIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ task_id: string }>(
    `SELECT DISTINCT task_id FROM task_reminders
      WHERE deleted_at IS NULL AND task_id IN (${placeholders})`,
    taskIds
  );
  return new Set(rows.map((r) => r.task_id));
}
