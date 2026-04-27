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

// All active reminder rows across all (non-deleted, non-done) tasks. Used by
// the scheduler's boot-reconcile pass to figure out what should be armed.
// Joined so we get the task's dueAt + dueTime alongside each reminder.
export async function listAllActiveRemindersWithTask(): Promise<
  Array<{
    reminderId: string;
    taskId: string;
    leadMinutes: number;
    scheduledNotificationId: string | null;
    taskTitle: string;
    taskDueAt: number | null;
    taskDueTime: number | null;
  }>
> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    reminder_id: string;
    task_id: string;
    lead_minutes: number;
    scheduled_notification_id: string | null;
    title: string;
    due_at: number | null;
    due_time: number | null;
  }>(
    `SELECT r.id          AS reminder_id,
            r.task_id     AS task_id,
            r.lead_minutes AS lead_minutes,
            r.scheduled_notification_id AS scheduled_notification_id,
            t.title       AS title,
            t.due_at      AS due_at,
            t.due_time    AS due_time
       FROM task_reminders r
       JOIN tasks t ON t.id = r.task_id
      WHERE r.deleted_at IS NULL
        AND t.deleted_at IS NULL
        AND t.status = 'pending'`
  );
  return rows.map((r) => ({
    reminderId: r.reminder_id,
    taskId: r.task_id,
    leadMinutes: r.lead_minutes,
    scheduledNotificationId: r.scheduled_notification_id,
    taskTitle: r.title,
    taskDueAt: r.due_at,
    taskDueTime: r.due_time,
  }));
}
