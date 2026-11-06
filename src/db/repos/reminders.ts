import { getDb } from '../client';
import { emit } from '../events';
import { newId } from '../ids';
import { now } from '../time';
import { reminderFromRow, type Reminder, type ReminderType } from '../schema';
import type { ReminderScheduleState } from '../schema';
import { timestampFromDateKey } from '../../lib/date';
import { queryChunks } from '../query';

export type CreateReminderInput = {
  taskId: string;
  leadMinutes: number;            // 0 = at time of task
  type?: ReminderType;            // default 'notification'
};

export type UpdateReminderInput = {
  leadMinutes?: number;
  type?: ReminderType;
  scheduledNotificationId?: string | null;
  scheduleState?: ReminderScheduleState;
  scheduleError?: string | null;
  scheduledFor?: number | null;
};

function validateLeadMinutes(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 525_600) {
    throw new Error('Choose a valid reminder time.');
  }
}

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

export async function getActiveReminderByScheduledNotificationId(
  scheduledNotificationId: string
): Promise<{
  reminderId: string;
  taskId: string;
  taskTitle: string;
} | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    reminder_id: string;
    task_id: string;
    title: string;
  }>(
    `SELECT r.id AS reminder_id,
            r.task_id AS task_id,
            t.title AS title
       FROM task_reminders r
       JOIN tasks t ON t.id = r.task_id
      WHERE r.deleted_at IS NULL
        AND t.deleted_at IS NULL
        AND t.status = 'pending'
        AND r.scheduled_notification_id = ?`,
    [scheduledNotificationId]
  );
  if (!row) return null;
  return {
    reminderId: row.reminder_id,
    taskId: row.task_id,
    taskTitle: row.title,
  };
}

export async function createReminder(input: CreateReminderInput): Promise<Reminder> {
  const db = await getDb();
  const id = newId();
  const ts = now();
  validateLeadMinutes(input.leadMinutes);
  const task = await db.getFirstAsync<{ due_date: string | null }>(
    `SELECT due_date FROM tasks WHERE id = ? AND deleted_at IS NULL`,
    [input.taskId]
  );
  if (!task) throw new Error('Task no longer exists.');
  if (!task.due_date) throw new Error('Choose a task date before adding a reminder.');
  await db.runAsync(
    `INSERT INTO task_reminders
       (id, task_id, lead_minutes, type, scheduled_notification_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    [id, input.taskId, input.leadMinutes, input.type ?? 'notification', ts, ts]
  );
  const created = await getReminderById(id);
  if (!created) throw new Error('Reminder insert succeeded but row not found');
  emit('tasks-changed');
  return created;
}

// NOTE: updateReminder intentionally does NOT emit. It's hit by the
// notification scheduler whenever it persists a scheduled_notification_id,
// and emitting from here would cause "schedule → emit → reconcile → schedule"
// loops. Reminder content changes (lead_minutes, type) are exclusively driven
// by updateTaskFull, which already emits at the task level.
export async function updateReminder(id: string, patch: UpdateReminderInput): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if (patch.leadMinutes !== undefined) {
    validateLeadMinutes(patch.leadMinutes);
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
  if (patch.scheduleState !== undefined) {
    sets.push('schedule_state = ?');
    args.push(patch.scheduleState);
  }
  if (patch.scheduleError !== undefined) {
    sets.push('schedule_error = ?');
    args.push(patch.scheduleError);
  }
  if (patch.scheduledFor !== undefined) {
    sets.push('scheduled_for = ?');
    args.push(patch.scheduledFor);
  }

  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  args.push(now());
  args.push(id);

  await db.runAsync(
    `UPDATE task_reminders SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    args
  );
}

export async function softDeleteReminder(id: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.runAsync(
    `UPDATE task_reminders SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [ts, ts, id]
  );
  emit('tasks-changed');
}

// Set of task ids that currently have at least one active reminder.
export async function taskIdsWithReminders(taskIds: string[]): Promise<Set<string>> {
  if (taskIds.length === 0) return new Set();
  const db = await getDb();
  const out = new Set<string>();
  for (const chunk of queryChunks(taskIds)) {
    const placeholders = chunk.map(() => '?').join(',');
    const rows = await db.getAllAsync<{ task_id: string }>(
      `SELECT DISTINCT task_id FROM task_reminders
        WHERE deleted_at IS NULL AND task_id IN (${placeholders})`,
      chunk
    );
    for (const row of rows) out.add(row.task_id);
  }
  return out;
}

export async function healthByTaskIds(
  taskIds: string[]
): Promise<Record<string, ReminderScheduleState>> {
  if (taskIds.length === 0) return {};
  const db = await getDb();
  const priority: Record<ReminderScheduleState, number> = {
    error: 5,
    permission_denied: 4,
    invalid: 3,
    pending: 2,
    scheduled: 1,
  };
  const out: Record<string, ReminderScheduleState> = {};
  for (const chunk of queryChunks(taskIds)) {
    const placeholders = chunk.map(() => '?').join(',');
    const rows = await db.getAllAsync<{ task_id: string; schedule_state: ReminderScheduleState }>(
      `SELECT task_id, schedule_state FROM task_reminders
        WHERE deleted_at IS NULL AND task_id IN (${placeholders})`,
      chunk
    );
    for (const row of rows) {
      const current = out[row.task_id];
      if (!current || priority[row.schedule_state] > priority[current]) {
        out[row.task_id] = row.schedule_state;
      }
    }
  }
  return out;
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
    scheduleState: ReminderScheduleState;
    scheduledFor: number | null;
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
    schedule_state: ReminderScheduleState;
    scheduled_for: number | null;
    title: string;
    due_date: string | null;
    due_time: number | null;
  }>(
    `SELECT r.id          AS reminder_id,
            r.task_id     AS task_id,
            r.lead_minutes AS lead_minutes,
            r.scheduled_notification_id AS scheduled_notification_id,
            r.schedule_state AS schedule_state,
            r.scheduled_for AS scheduled_for,
            t.title       AS title,
            t.due_date    AS due_date,
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
    scheduleState: r.schedule_state,
    scheduledFor: r.scheduled_for,
    taskTitle: r.title,
    taskDueAt: r.due_date ? timestampFromDateKey(r.due_date) : null,
    taskDueTime: r.due_time,
  }));
}
