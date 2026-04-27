import { nextOccurrence } from '../../lib/recurrence';
import { getDb } from '../client';
import { newId } from '../ids';
import { now } from '../time';
import { taskFromRow, type Task, type TaskStatus } from '../schema';

export type CreateTaskInput = {
  title: string;
  notes?: string | null;
  categoryId?: string | null;
  dueAt?: number | null;     // epoch ms, start of day
  dueTime?: number | null;   // minutes since midnight
  isPinned?: boolean;
  sortOrder?: number;
};

export type UpdateTaskInput = {
  title?: string;
  notes?: string | null;
  categoryId?: string | null;
  dueAt?: number | null;
  dueTime?: number | null;
  status?: TaskStatus;
  isPinned?: boolean;
  sortOrder?: number;
};

export type ListTasksFilter = {
  status?: TaskStatus | 'all';            // default 'pending'
  categoryId?: string | null;             // null = no category, undefined = any
  dueAtMin?: number;
  dueAtMax?: number;
  pinnedFirst?: boolean;                  // default true
};

export async function listTasks(filter: ListTasksFilter = {}): Promise<Task[]> {
  const db = await getDb();

  const where: string[] = ['deleted_at IS NULL'];
  const args: (string | number | null)[] = [];

  const status = filter.status ?? 'pending';
  if (status !== 'all') {
    where.push('status = ?');
    args.push(status);
  }

  if (filter.categoryId !== undefined) {
    if (filter.categoryId === null) {
      where.push('category_id IS NULL');
    } else {
      where.push('category_id = ?');
      args.push(filter.categoryId);
    }
  }

  if (filter.dueAtMin !== undefined) {
    where.push('due_at >= ?');
    args.push(filter.dueAtMin);
  }
  if (filter.dueAtMax !== undefined) {
    where.push('due_at <= ?');
    args.push(filter.dueAtMax);
  }

  const orderBy = filter.pinnedFirst === false
    ? 'due_at ASC NULLS LAST, due_time ASC NULLS LAST, sort_order ASC, created_at ASC'
    : 'is_pinned DESC, due_at ASC NULLS LAST, due_time ASC NULLS LAST, sort_order ASC, created_at ASC';

  const rows = await db.getAllAsync<unknown>(
    `SELECT * FROM tasks WHERE ${where.join(' AND ')} ORDER BY ${orderBy}`,
    args
  );
  return rows.map(taskFromRow);
}

export async function getTaskById(id: string): Promise<Task | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<unknown>(
    `SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return row ? taskFromRow(row) : null;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const db = await getDb();
  const id = newId();
  const ts = now();
  await db.runAsync(
    `INSERT INTO tasks
       (id, title, notes, category_id, due_at, due_time, status, is_pinned, completed_at, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NULL, ?, ?, ?)`,
    [
      id,
      input.title,
      input.notes ?? null,
      input.categoryId ?? null,
      input.dueAt ?? null,
      input.dueTime ?? null,
      input.isPinned ? 1 : 0,
      input.sortOrder ?? 0,
      ts,
      ts,
    ]
  );
  const created = await getTaskById(id);
  if (!created) throw new Error('Task insert succeeded but row not found');
  return created;
}

export async function updateTask(id: string, patch: UpdateTaskInput): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if (patch.title !== undefined)      { sets.push('title = ?');       args.push(patch.title); }
  if (patch.notes !== undefined)      { sets.push('notes = ?');       args.push(patch.notes); }
  if (patch.categoryId !== undefined) { sets.push('category_id = ?'); args.push(patch.categoryId); }
  if (patch.dueAt !== undefined)      { sets.push('due_at = ?');      args.push(patch.dueAt); }
  if (patch.dueTime !== undefined)    { sets.push('due_time = ?');    args.push(patch.dueTime); }
  if (patch.status !== undefined)     { sets.push('status = ?');      args.push(patch.status); }
  if (patch.isPinned !== undefined)   { sets.push('is_pinned = ?');   args.push(patch.isPinned ? 1 : 0); }
  if (patch.sortOrder !== undefined)  { sets.push('sort_order = ?');  args.push(patch.sortOrder); }

  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  args.push(now());
  args.push(id);

  await db.runAsync(
    `UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`,
    args
  );
}

// Convenience: complete a task and stamp completed_at atomically.
export async function completeTask(id: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.runAsync(
    `UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?`,
    [ts, ts, id]
  );
}

export async function uncompleteTask(id: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.runAsync(
    `UPDATE tasks SET status = 'pending', completed_at = NULL, updated_at = ? WHERE id = ?`,
    [ts, id]
  );
}

// Pin / unpin without thinking about update payload shape at the call site.
export async function setPinned(id: string, pinned: boolean): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.runAsync(
    `UPDATE tasks SET is_pinned = ?, updated_at = ? WHERE id = ?`,
    [pinned ? 1 : 0, ts, id]
  );
}

export async function softDeleteTask(id: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.runAsync(
    `UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [ts, ts, id]
  );
}

// Composite create: parent task + N subtasks + N reminders + optional repeat
// rule, all in one transaction. All-or-nothing semantics.
export type CreateTaskFullInput = {
  task: CreateTaskInput;
  subtaskTitles: string[];
  reminders?: Array<{ leadMinutes: number; type?: 'notification' | 'silent' | 'alarm' }>;
  repeatRule?: {
    freq: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
    intervalN?: number;
    byWeekday?: string | null;
    byMonthDay?: number | null;
    byMonth?: number | null;
    untilAt?: number | null;
  } | null;
};

export async function createTaskFull(input: CreateTaskFullInput): Promise<Task> {
  const db = await getDb();
  const taskId = newId();
  const ts = now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO tasks
         (id, title, notes, category_id, due_at, due_time, status, is_pinned, completed_at, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NULL, ?, ?, ?)`,
      [
        taskId,
        input.task.title,
        input.task.notes ?? null,
        input.task.categoryId ?? null,
        input.task.dueAt ?? null,
        input.task.dueTime ?? null,
        input.task.isPinned ? 1 : 0,
        input.task.sortOrder ?? 0,
        ts,
        ts,
      ]
    );

    for (let i = 0; i < input.subtaskTitles.length; i++) {
      const title = input.subtaskTitles[i]!.trim();
      if (title.length === 0) continue;
      await db.runAsync(
        `INSERT INTO subtasks (id, task_id, title, status, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
        [newId(), taskId, title, i, ts, ts]
      );
    }

    if (input.reminders && input.reminders.length > 0) {
      for (const r of input.reminders) {
        await db.runAsync(
          `INSERT INTO task_reminders
             (id, task_id, lead_minutes, type, scheduled_notification_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, ?, ?)`,
          [newId(), taskId, r.leadMinutes, r.type ?? 'notification', ts, ts]
        );
      }
    }

    if (input.repeatRule) {
      const rr = input.repeatRule;
      await db.runAsync(
        `INSERT INTO task_repeat_rules
           (id, task_id, freq, interval_n, by_weekday, by_month_day, by_month, until_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          taskId,
          rr.freq,
          rr.intervalN ?? 1,
          rr.byWeekday ?? null,
          rr.byMonthDay ?? null,
          rr.byMonth ?? null,
          rr.untilAt ?? null,
          ts,
          ts,
        ]
      );
    }
  });

  const created = await getTaskById(taskId);
  if (!created) throw new Error('Task insert succeeded but row not found');
  return created;
}

/**
 * For a task that just completed, compute the next occurrence per its repeat
 * rule and insert a new task carrying forward its subtasks, reminders, and
 * the same repeat rule. Returns the new task or null if the recurrence has
 * run out (no rule, or untilAt exceeded).
 *
 * Single transaction. Idempotency is the caller's responsibility — if you
 * call this twice for the same source task you'll get two child tasks.
 */
export async function spawnNextOccurrence(sourceTaskId: string): Promise<Task | null> {
  const db = await getDb();

  const sourceTask = await db.getFirstAsync<{
    id: string;
    title: string;
    notes: string | null;
    category_id: string | null;
    due_at: number | null;
    due_time: number | null;
    is_pinned: number;
    sort_order: number;
  }>(
    `SELECT id, title, notes, category_id, due_at, due_time, is_pinned, sort_order
       FROM tasks WHERE id = ? AND deleted_at IS NULL`,
    [sourceTaskId]
  );
  if (!sourceTask) return null;

  const rule = await db.getFirstAsync<{
    freq: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
    interval_n: number;
    by_weekday: string | null;
    by_month_day: number | null;
    by_month: number | null;
    until_at: number | null;
  }>(
    `SELECT freq, interval_n, by_weekday, by_month_day, by_month, until_at
       FROM task_repeat_rules
      WHERE task_id = ? AND deleted_at IS NULL`,
    [sourceTaskId]
  );
  if (!rule) return null;

  // Compute the next occurrence using the source task's dueAt as the anchor.
  // If the task didn't have a due date (defensive guard), there's nothing to
  // bump forward.
  if (sourceTask.due_at === null) return null;
  const nextDueAt = nextOccurrence(
    {
      freq: rule.freq,
      intervalN: rule.interval_n,
      byWeekday: rule.by_weekday,
      byMonthDay: rule.by_month_day,
      byMonth: rule.by_month,
      untilAt: rule.until_at,
    },
    sourceTask.due_at
  );
  if (nextDueAt === null) return null;

  // Read subtasks and reminders to clone forward.
  const subtaskRows = await db.getAllAsync<{ title: string; sort_order: number }>(
    `SELECT title, sort_order FROM subtasks
      WHERE task_id = ? AND deleted_at IS NULL
      ORDER BY sort_order ASC, created_at ASC`,
    [sourceTaskId]
  );
  const reminderRows = await db.getAllAsync<{
    lead_minutes: number;
    type: 'notification' | 'silent' | 'alarm';
  }>(
    `SELECT lead_minutes, type FROM task_reminders
      WHERE task_id = ? AND deleted_at IS NULL`,
    [sourceTaskId]
  );

  const newTaskId = newId();
  const ts = now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO tasks
         (id, title, notes, category_id, due_at, due_time, status, is_pinned, completed_at, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NULL, ?, ?, ?)`,
      [
        newTaskId,
        sourceTask.title,
        sourceTask.notes,
        sourceTask.category_id,
        nextDueAt,
        sourceTask.due_time,
        // Don't carry pinning forward — the new occurrence starts un-pinned.
        0,
        sourceTask.sort_order,
        ts,
        ts,
      ]
    );

    for (const s of subtaskRows) {
      // New subtasks always start in 'pending' status — completion of the
      // previous occurrence's subtasks doesn't carry over.
      await db.runAsync(
        `INSERT INTO subtasks (id, task_id, title, status, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
        [newId(), newTaskId, s.title, s.sort_order, ts, ts]
      );
    }

    for (const r of reminderRows) {
      await db.runAsync(
        `INSERT INTO task_reminders
           (id, task_id, lead_minutes, type, scheduled_notification_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`,
        [newId(), newTaskId, r.lead_minutes, r.type, ts, ts]
      );
    }

    // Carry the repeat rule forward unchanged so the chain continues.
    await db.runAsync(
      `INSERT INTO task_repeat_rules
         (id, task_id, freq, interval_n, by_weekday, by_month_day, by_month, until_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        newTaskId,
        rule.freq,
        rule.interval_n,
        rule.by_weekday,
        rule.by_month_day,
        rule.by_month,
        rule.until_at,
        ts,
        ts,
      ]
    );
  });

  const created = await getTaskById(newTaskId);
  if (!created) throw new Error('Spawn insert succeeded but row not found');
  return created;
}
