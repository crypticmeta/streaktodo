import type { SQLiteDatabase } from 'expo-sqlite';
import { nextOccurrence } from '../../lib/recurrence';
import {
  dateKeyFromTimestamp,
  isCalendarDate,
  timestampFromDateKey,
  type CalendarDate,
} from '../../lib/date';
import { getDb } from '../client';
import { emit } from '../events';
import { newId } from '../ids';
import { now } from '../time';
import { withExclusiveTransaction } from '../transactions';
import {
  subtaskFromRow,
  taskFromRow,
  type Subtask,
  type SubtaskStatus,
  type Task,
  type TaskStatus,
} from '../schema';

export type CreateTaskInput = {
  title: string;
  notes?: string | null;
  categoryId?: string | null;
  dueAt?: number | null;
  dueDate?: CalendarDate | null;
  dueTime?: number | null;
  isPinned?: boolean;
  sortOrder?: number;
};

export type UpdateTaskInput = {
  title?: string;
  notes?: string | null;
  categoryId?: string | null;
  dueAt?: number | null;
  dueDate?: CalendarDate | null;
  dueTime?: number | null;
  isPinned?: boolean;
  sortOrder?: number;
};

export type ListTasksFilter = {
  status?: TaskStatus | 'all';
  categoryId?: string | null;
  dueAtMin?: number;
  dueAtMax?: number;
  dueDate?: 'dated' | 'undated';
  query?: string;
  deleted?: 'active' | 'only' | 'all';
  pinnedFirst?: boolean;
  limit?: number;
  offset?: number;
};

type TaskWhere = {
  clause: string;
  args: Array<string | number | null>;
};

function buildTaskWhere(filter: ListTasksFilter): TaskWhere {
  const where: string[] = [];
  const args: Array<string | number | null> = [];

  const deleted = filter.deleted ?? 'active';
  if (deleted === 'active') where.push('deleted_at IS NULL');
  if (deleted === 'only') where.push('deleted_at IS NOT NULL');

  const status = filter.status ?? 'pending';
  if (status !== 'all') {
    where.push('status = ?');
    args.push(status);
  }

  if (filter.categoryId !== undefined) {
    if (filter.categoryId === null) where.push('category_id IS NULL');
    else {
      where.push('category_id = ?');
      args.push(filter.categoryId);
    }
  }

  if (filter.dueAtMin !== undefined) {
    where.push('due_date >= ?');
    args.push(dateKeyFromTimestamp(filter.dueAtMin));
  }
  if (filter.dueAtMax !== undefined) {
    where.push('due_date <= ?');
    args.push(dateKeyFromTimestamp(filter.dueAtMax));
  }
  if (filter.dueDate === 'dated') where.push('due_date IS NOT NULL');
  if (filter.dueDate === 'undated') where.push('due_date IS NULL');

  const query = filter.query?.trim();
  if (query) {
    where.push(`(title LIKE ? ESCAPE '\\' OR notes LIKE ? ESCAPE '\\')`);
    const escaped = query.replace(/[\\%_]/g, (part) => `\\${part}`);
    args.push(`%${escaped}%`, `%${escaped}%`);
  }

  return {
    clause: where.length ? ` WHERE ${where.join(' AND ')}` : '',
    args,
  };
}

function resolveDueDate(input: { dueAt?: number | null; dueDate?: CalendarDate | null }): CalendarDate | null {
  if (input.dueDate !== undefined) return input.dueDate;
  return input.dueAt == null ? null : dateKeyFromTimestamp(input.dueAt);
}

function dueTimestamp(date: CalendarDate | null): number | null {
  return date ? timestampFromDateKey(date) : null;
}

export async function listTasks(filter: ListTasksFilter = {}): Promise<Task[]> {
  const db = await getDb();
  const { clause, args } = buildTaskWhere(filter);

  const orderBy = filter.pinnedFirst === false
    ? 'due_date ASC NULLS LAST, due_time ASC NULLS LAST, sort_order ASC, created_at ASC'
    : 'is_pinned DESC, due_date ASC NULLS LAST, due_time ASC NULLS LAST, sort_order ASC, created_at ASC';
  const limit = filter.limit === undefined ? '' : ' LIMIT ? OFFSET ?';
  if (filter.limit !== undefined) {
    args.push(Math.max(1, Math.floor(filter.limit)), Math.max(0, Math.floor(filter.offset ?? 0)));
  }

  const rows = await db.getAllAsync<unknown>(
    `SELECT * FROM tasks${clause} ORDER BY ${orderBy}${limit}`,
    args
  );
  return rows.map(taskFromRow);
}

/** Count a task view without materializing rows; limit/offset are ignored. */
export async function countTasks(filter: ListTasksFilter = {}): Promise<number> {
  const db = await getDb();
  const { clause, args } = buildTaskWhere(filter);
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM tasks${clause}`,
    args
  );
  return row?.count ?? 0;
}

export async function listDueDaysInRange(args: { fromTs: number; toTs: number }): Promise<Set<number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ due_date: string }>(
    `SELECT DISTINCT due_date FROM tasks
      WHERE deleted_at IS NULL AND due_date IS NOT NULL
        AND due_date >= ? AND due_date <= ?`,
    [dateKeyFromTimestamp(args.fromTs), dateKeyFromTimestamp(args.toTs)]
  );
  return new Set(rows.map((row) => timestampFromDateKey(row.due_date)));
}

async function getTaskByIdFrom(db: SQLiteDatabase, id: string, includeDeleted = false): Promise<Task | null> {
  const row = await db.getFirstAsync<unknown>(
    `SELECT * FROM tasks WHERE id = ?${includeDeleted ? '' : ' AND deleted_at IS NULL'}`,
    [id]
  );
  return row ? taskFromRow(row) : null;
}

export async function getTaskById(id: string): Promise<Task | null> {
  return getTaskByIdFrom(await getDb(), id);
}

export type TaskGraph = {
  task: Task;
  subtasks: Subtask[];
  subtaskTitles: string[];
  reminders: Array<{
    id: string;
    leadMinutes: number;
    type: 'notification' | 'silent' | 'alarm';
    scheduledNotificationId: string | null;
  }>;
  repeatRule: {
    freq: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
    intervalN: number;
    byWeekday: string | null;
    byMonthDay: number | null;
    byMonth: number | null;
    untilAt: number | null;
    anchorDate: CalendarDate | null;
    untilDate: CalendarDate | null;
  } | null;
};

export async function getTaskGraph(id: string): Promise<TaskGraph | null> {
  const db = await getDb();
  const task = await getTaskByIdFrom(db, id);
  if (!task) return null;

  const [subtaskRows, reminderRows, ruleRow] = await Promise.all([
    db.getAllAsync<unknown>(
      `SELECT * FROM subtasks WHERE task_id = ? AND deleted_at IS NULL ORDER BY sort_order, created_at`,
      [id]
    ),
    db.getAllAsync<{
      id: string;
      lead_minutes: number;
      type: 'notification' | 'silent' | 'alarm';
      scheduled_notification_id: string | null;
    }>(
      `SELECT id, lead_minutes, type, scheduled_notification_id FROM task_reminders
        WHERE task_id = ? AND deleted_at IS NULL ORDER BY lead_minutes DESC`,
      [id]
    ),
    db.getFirstAsync<{
      freq: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
      interval_n: number;
      by_weekday: string | null;
      by_month_day: number | null;
      by_month: number | null;
      until_at: number | null;
      anchor_date: CalendarDate | null;
      until_date: CalendarDate | null;
    }>(
      `SELECT freq, interval_n, by_weekday, by_month_day, by_month,
              until_at, anchor_date, until_date
         FROM task_repeat_rules WHERE task_id = ? AND deleted_at IS NULL`,
      [id]
    ),
  ]);
  const subtasks = subtaskRows.map(subtaskFromRow);
  return {
    task,
    subtasks,
    subtaskTitles: subtasks.map((subtask) => subtask.title),
    reminders: reminderRows.map((row) => ({
      id: row.id,
      leadMinutes: row.lead_minutes,
      type: row.type,
      scheduledNotificationId: row.scheduled_notification_id,
    })),
    repeatRule: ruleRow
      ? {
          freq: ruleRow.freq,
          intervalN: ruleRow.interval_n,
          byWeekday: ruleRow.by_weekday,
          byMonthDay: ruleRow.by_month_day,
          byMonth: ruleRow.by_month,
          untilAt: ruleRow.until_date
            ? timestampFromDateKey(ruleRow.until_date)
            : ruleRow.until_at,
          anchorDate: ruleRow.anchor_date,
          untilDate: ruleRow.until_date,
        }
      : null,
  };
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  return createTaskFull({ task: input, subtaskTitles: [] });
}

export async function updateTask(id: string, patch: UpdateTaskInput): Promise<void> {
  const db = await getDb();
  const current = await getTaskByIdFrom(db, id);
  if (!current) throw new Error('Task no longer exists.');
  const hasDuePatch = patch.dueAt !== undefined || patch.dueDate !== undefined;
  const nextDueDate = hasDuePatch ? resolveDueDate(patch) : current.dueDate;
  const nextDueTime = nextDueDate
    ? patch.dueTime === undefined ? current.dueTime : patch.dueTime
    : null;
  if (patch.title !== undefined && !patch.title.trim()) throw new Error('Add a task title.');
  if ((patch.title?.trim().length ?? 0) > 140) {
    throw new Error('Task titles can be up to 140 characters.');
  }
  if ((patch.notes?.length ?? 0) > 1000) throw new Error('Notes can be up to 1,000 characters.');
  if (nextDueDate !== null && !isCalendarDate(nextDueDate)) throw new Error('Choose a valid task date.');
  if (
    nextDueTime !== null &&
    (!Number.isInteger(nextDueTime) || nextDueTime < 0 || nextDueTime > 1439)
  ) {
    throw new Error('Choose a valid task time.');
  }
  if (patch.sortOrder !== undefined && !Number.isInteger(patch.sortOrder)) {
    throw new Error('Task order must be a whole number.');
  }
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if (patch.title !== undefined) { sets.push('title = ?'); args.push(patch.title.trim()); }
  if (patch.notes !== undefined) { sets.push('notes = ?'); args.push(patch.notes); }
  if (patch.categoryId !== undefined) { sets.push('category_id = ?'); args.push(patch.categoryId); }
  if (hasDuePatch) {
    const date = nextDueDate;
    sets.push('due_date = ?', 'due_at = ?');
    args.push(date, dueTimestamp(date));
  }
  if (patch.dueTime !== undefined || (hasDuePatch && nextDueDate === null)) {
    sets.push('due_time = ?');
    args.push(nextDueTime);
  }
  if (patch.isPinned !== undefined) { sets.push('is_pinned = ?'); args.push(patch.isPinned ? 1 : 0); }
  if (patch.sortOrder !== undefined) { sets.push('sort_order = ?'); args.push(patch.sortOrder); }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  args.push(now(), id);
  await db.runAsync(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`, args);
  emit('tasks-changed');
}

export type EditableSubtask = {
  id?: string;
  title: string;
  status?: SubtaskStatus;
};

export type RepeatRuleWrite = {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  intervalN?: number;
  byWeekday?: string | null;
  byMonthDay?: number | null;
  byMonth?: number | null;
  untilAt?: number | null;
  anchorDate?: CalendarDate | null;
  untilDate?: CalendarDate | null;
};

export type CreateTaskFullInput = {
  task: CreateTaskInput;
  subtaskTitles: string[];
  subtasks?: EditableSubtask[];
  reminders?: Array<{ leadMinutes: number; type?: 'notification' | 'silent' | 'alarm' }>;
  repeatRule?: RepeatRuleWrite | null;
};

function normalizedSubtasks(input: CreateTaskFullInput): EditableSubtask[] {
  return (input.subtasks ?? input.subtaskTitles.map((title) => ({ title })))
    .map((subtask) => ({ ...subtask, title: subtask.title.trim() }))
    .filter((subtask) => subtask.title.length > 0);
}

function validateTaskWrite(input: CreateTaskFullInput, dueDate: CalendarDate | null): void {
  const title = input.task.title.trim();
  if (!title) throw new Error('Add a task title.');
  if (title.length > 140) throw new Error('Task titles can be up to 140 characters.');
  if ((input.task.notes?.length ?? 0) > 1000) throw new Error('Notes can be up to 1,000 characters.');
  if (dueDate !== null && !isCalendarDate(dueDate)) throw new Error('Choose a valid task date.');
  if (
    input.task.dueTime !== undefined &&
    input.task.dueTime !== null &&
    (!Number.isInteger(input.task.dueTime) || input.task.dueTime < 0 || input.task.dueTime > 1439)
  ) {
    throw new Error('Choose a valid task time.');
  }
  const subtasks = normalizedSubtasks(input);
  if (subtasks.length > 25) throw new Error('A task can have up to 25 subtasks.');
  if (subtasks.some((subtask) => subtask.title.length > 120)) {
    throw new Error('Subtask titles can be up to 120 characters.');
  }
  if ((input.reminders?.length ?? 0) > 10) throw new Error('A task can have up to 10 reminders.');
  if (input.reminders?.some((reminder) => (
    !Number.isInteger(reminder.leadMinutes) ||
    reminder.leadMinutes < 0 ||
    reminder.leadMinutes > 525_600
  ))) {
    throw new Error('Choose a valid reminder time.');
  }
  if (!dueDate && ((input.reminders?.length ?? 0) > 0 || input.repeatRule)) {
    throw new Error('Choose a date before adding a reminder or repeat rule.');
  }
  if (input.repeatRule) {
    const rule = input.repeatRule;
    const intervalN = rule.intervalN ?? 1;
    if (!Number.isInteger(intervalN) || intervalN < 1 || intervalN > 999) {
      throw new Error('Repeat interval must be between 1 and 999.');
    }
    if (rule.byWeekday !== undefined && rule.byWeekday !== null &&
      !/^(SU|MO|TU|WE|TH|FR|SA)(,(SU|MO|TU|WE|TH|FR|SA))*$/.test(rule.byWeekday)) {
      throw new Error('Choose valid repeat weekdays.');
    }
    if (rule.byMonthDay !== undefined && rule.byMonthDay !== null &&
      (!Number.isInteger(rule.byMonthDay) || rule.byMonthDay < 1 || rule.byMonthDay > 31)) {
      throw new Error('Choose a valid day of the month.');
    }
    if (rule.byMonth !== undefined && rule.byMonth !== null &&
      (!Number.isInteger(rule.byMonth) || rule.byMonth < 1 || rule.byMonth > 12)) {
      throw new Error('Choose a valid month.');
    }
    const untilDate = rule.untilDate !== undefined
      ? rule.untilDate
      : rule.untilAt == null ? null : dateKeyFromTimestamp(rule.untilAt);
    const anchorDate = rule.anchorDate ?? dueDate;
    if (untilDate !== null && !isCalendarDate(untilDate)) {
      throw new Error('Choose a valid repeat end date.');
    }
    if (untilDate && anchorDate && untilDate < anchorDate) {
      throw new Error('Repeat end date cannot be before its start date.');
    }
  }
}

async function insertRepeatRule(
  tx: SQLiteDatabase,
  taskId: string,
  dueDate: CalendarDate | null,
  rule: RepeatRuleWrite,
  ts: number
): Promise<void> {
  const untilDate = rule.untilDate !== undefined
    ? rule.untilDate
    : rule.untilAt == null
      ? null
      : dateKeyFromTimestamp(rule.untilAt);
  await tx.runAsync(
    `INSERT INTO task_repeat_rules
       (id, task_id, freq, interval_n, by_weekday, by_month_day, by_month,
        until_at, anchor_date, until_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(), taskId, rule.freq, Math.max(1, Math.floor(rule.intervalN ?? 1)),
      rule.byWeekday ?? null, rule.byMonthDay ?? null, rule.byMonth ?? null,
      untilDate ? timestampFromDateKey(untilDate) : null,
      rule.anchorDate ?? dueDate, untilDate, ts, ts,
    ]
  );
}

export async function createTaskFull(input: CreateTaskFullInput): Promise<Task> {
  const db = await getDb();
  const taskId = newId();
  const ts = now();
  const dueDate = resolveDueDate(input.task);
  validateTaskWrite(input, dueDate);
  const subtasks = normalizedSubtasks(input);
  const dueTime = dueDate ? input.task.dueTime ?? null : null;

  await withExclusiveTransaction(db, async (tx) => {
    await tx.runAsync(
      `INSERT INTO tasks
         (id, title, notes, category_id, due_at, due_date, due_time, status,
          is_pinned, completed_at, sort_order, created_at, updated_at, series_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL, ?, ?, ?, ?)`,
      [
        taskId, input.task.title.trim(), input.task.notes ?? null,
        input.task.categoryId ?? null, dueTimestamp(dueDate), dueDate,
        dueTime, input.task.isPinned ? 1 : 0,
        input.task.sortOrder ?? 0, ts, ts, input.repeatRule ? taskId : null,
      ]
    );
    for (let index = 0; index < subtasks.length; index += 1) {
      const subtask = subtasks[index]!;
      await tx.runAsync(
        `INSERT INTO subtasks (id, task_id, title, status, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId(), taskId, subtask.title, subtask.status ?? 'pending', index, ts, ts]
      );
    }
    for (const reminder of input.reminders ?? []) {
      await tx.runAsync(
        `INSERT INTO task_reminders
           (id, task_id, lead_minutes, type, scheduled_notification_id,
            schedule_state, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, 'pending', ?, ?)`,
        [newId(), taskId, reminder.leadMinutes, reminder.type ?? 'notification', ts, ts]
      );
    }
    if (input.repeatRule) {
      await insertRepeatRule(tx, taskId, dueDate, input.repeatRule, ts);
    }
  });

  const created = await getTaskByIdFrom(db, taskId);
  if (!created) throw new Error('Task was saved but could not be read.');
  emit('tasks-changed');
  return created;
}

export async function updateTaskFull(sourceTaskId: string, input: CreateTaskFullInput): Promise<Task> {
  const db = await getDb();
  const ts = now();
  const dueDate = resolveDueDate(input.task);
  validateTaskWrite(input, dueDate);
  const incomingSubtasks = normalizedSubtasks(input);
  const dueTime = dueDate ? input.task.dueTime ?? null : null;

  await withExclusiveTransaction(db, async (tx) => {
    await tx.runAsync(
      `UPDATE tasks SET title = ?, notes = ?, category_id = ?, due_at = ?, due_date = ?,
          due_time = ?, is_pinned = COALESCE(?, is_pinned),
          sort_order = COALESCE(?, sort_order), updated_at = ?,
          series_id = CASE WHEN ? THEN COALESCE(series_id, id) ELSE series_id END
        WHERE id = ? AND deleted_at IS NULL`,
      [
        input.task.title.trim(), input.task.notes ?? null, input.task.categoryId ?? null,
        dueTimestamp(dueDate), dueDate, dueTime,
        input.task.isPinned === undefined ? null : input.task.isPinned ? 1 : 0,
        input.task.sortOrder ?? null, ts,
        input.repeatRule ? 1 : 0, sourceTaskId,
      ]
    );

    const existingRows = await tx.getAllAsync<{ id: string; status: SubtaskStatus }>(
      `SELECT id, status FROM subtasks WHERE task_id = ? AND deleted_at IS NULL`,
      [sourceTaskId]
    );
    const existing = new Map(existingRows.map((row) => [row.id, row]));
    const kept = new Set<string>();
    for (let index = 0; index < incomingSubtasks.length; index += 1) {
      const subtask = incomingSubtasks[index]!;
      if (subtask.id && existing.has(subtask.id)) {
        kept.add(subtask.id);
        await tx.runAsync(
          `UPDATE subtasks SET title = ?, status = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
          [subtask.title, subtask.status ?? existing.get(subtask.id)!.status, index, ts, subtask.id]
        );
      } else {
        await tx.runAsync(
          `INSERT INTO subtasks (id, task_id, title, status, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newId(), sourceTaskId, subtask.title, subtask.status ?? 'pending', index, ts, ts]
        );
      }
    }
    for (const row of existingRows) {
      if (!kept.has(row.id)) {
        await tx.runAsync(
          `UPDATE subtasks SET deleted_at = ?, updated_at = ? WHERE id = ?`,
          [ts, ts, row.id]
        );
      }
    }

    await tx.runAsync(
      `UPDATE task_reminders SET deleted_at = ?, updated_at = ?,
          schedule_state = 'pending', scheduled_notification_id = NULL,
          scheduled_for = NULL
        WHERE task_id = ? AND deleted_at IS NULL`,
      [ts, ts, sourceTaskId]
    );
    for (const reminder of input.reminders ?? []) {
      await tx.runAsync(
        `INSERT INTO task_reminders
           (id, task_id, lead_minutes, type, scheduled_notification_id,
            schedule_state, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, 'pending', ?, ?)`,
        [newId(), sourceTaskId, reminder.leadMinutes, reminder.type ?? 'notification', ts, ts]
      );
    }

    await tx.runAsync(`DELETE FROM task_repeat_rules WHERE task_id = ?`, [sourceTaskId]);
    if (input.repeatRule) {
      await insertRepeatRule(tx, sourceTaskId, dueDate, input.repeatRule, ts);
    }
  });

  const updated = await getTaskByIdFrom(db, sourceTaskId);
  if (!updated) throw new Error('Task was updated but could not be read.');
  emit('tasks-changed');
  return updated;
}

type RawSourceTask = {
  id: string;
  title: string;
  notes: string | null;
  category_id: string | null;
  due_date: CalendarDate | null;
  due_time: number | null;
  status: TaskStatus;
  sort_order: number;
  series_id: string | null;
};

async function spawnNextOccurrenceInTransaction(
  tx: SQLiteDatabase,
  sourceTaskId: string
): Promise<Task | null> {
  const existing = await tx.getFirstAsync<unknown>(
    `SELECT * FROM tasks WHERE parent_occurrence_id = ? AND deleted_at IS NULL`,
    [sourceTaskId]
  );
  if (existing) return taskFromRow(existing);

  const source = await tx.getFirstAsync<RawSourceTask>(
    `SELECT id, title, notes, category_id, due_date, due_time, status,
            sort_order, series_id
       FROM tasks WHERE id = ? AND deleted_at IS NULL`,
    [sourceTaskId]
  );
  if (!source || source.status !== 'done' || !source.due_date) return null;

  const rule = await tx.getFirstAsync<{
    freq: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
    interval_n: number;
    by_weekday: string | null;
    by_month_day: number | null;
    by_month: number | null;
    until_date: CalendarDate | null;
    anchor_date: CalendarDate | null;
  }>(
    `SELECT freq, interval_n, by_weekday, by_month_day, by_month,
            until_date, anchor_date
       FROM task_repeat_rules WHERE task_id = ? AND deleted_at IS NULL`,
    [sourceTaskId]
  );
  if (!rule) return null;

  const fromTs = timestampFromDateKey(source.due_date);
  const nextDueAt = nextOccurrence(
    {
      freq: rule.freq,
      intervalN: rule.interval_n,
      byWeekday: rule.by_weekday,
      byMonthDay: rule.by_month_day,
      byMonth: rule.by_month,
      untilAt: rule.until_date ? timestampFromDateKey(rule.until_date) : null,
      anchorAt: rule.anchor_date ? timestampFromDateKey(rule.anchor_date) : fromTs,
    },
    fromTs
  );
  if (nextDueAt === null) return null;

  const nextDueDate = dateKeyFromTimestamp(nextDueAt);
  const nextTaskId = newId();
  const ts = now();
  const seriesId = source.series_id ?? source.id;
  await tx.runAsync(
    `INSERT INTO tasks
       (id, title, notes, category_id, due_at, due_date, due_time, status,
        is_pinned, completed_at, sort_order, created_at, updated_at,
        series_id, parent_occurrence_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?, ?, ?, ?, ?)`,
    [
      nextTaskId, source.title, source.notes, source.category_id, nextDueAt,
      nextDueDate, source.due_time, source.sort_order, ts, ts, seriesId, sourceTaskId,
    ]
  );

  const subtasks = await tx.getAllAsync<{ title: string; sort_order: number }>(
    `SELECT title, sort_order FROM subtasks WHERE task_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
    [sourceTaskId]
  );
  for (const subtask of subtasks) {
    await tx.runAsync(
      `INSERT INTO subtasks (id, task_id, title, status, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
      [newId(), nextTaskId, subtask.title, subtask.sort_order, ts, ts]
    );
  }
  const reminders = await tx.getAllAsync<{
    lead_minutes: number;
    type: 'notification' | 'silent' | 'alarm';
  }>(
    `SELECT lead_minutes, type FROM task_reminders WHERE task_id = ? AND deleted_at IS NULL`,
    [sourceTaskId]
  );
  for (const reminder of reminders) {
    await tx.runAsync(
      `INSERT INTO task_reminders
         (id, task_id, lead_minutes, type, scheduled_notification_id,
          schedule_state, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, 'pending', ?, ?)`,
      [newId(), nextTaskId, reminder.lead_minutes, reminder.type, ts, ts]
    );
  }
  await tx.runAsync(
    `INSERT INTO task_repeat_rules
       (id, task_id, freq, interval_n, by_weekday, by_month_day, by_month,
        until_at, anchor_date, until_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(), nextTaskId, rule.freq, rule.interval_n, rule.by_weekday,
      rule.by_month_day, rule.by_month,
      rule.until_date ? timestampFromDateKey(rule.until_date) : null,
      rule.anchor_date ?? source.due_date, rule.until_date, ts, ts,
    ]
  );
  return getTaskByIdFrom(tx, nextTaskId);
}

export type CompletionResult = {
  task: Task;
  spawned: Task | null;
  changed: boolean;
};

export async function completeTaskAndSpawnNext(id: string): Promise<CompletionResult> {
  const db = await getDb();
  const ts = now();
  const result = await withExclusiveTransaction(db, async (tx) => {
    const update = await tx.runAsync(
      `UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL AND status = 'pending'`,
      [ts, ts, id]
    );
    const task = await getTaskByIdFrom(tx, id);
    if (!task) throw new Error('Task no longer exists.');
    // Only a real pending -> done transition may create an occurrence.
    // Replayed taps / notification actions on an already-complete task must
    // never resurrect a future occurrence the user intentionally deleted.
    const spawned = update.changes > 0
      ? await spawnNextOccurrenceInTransaction(tx, id)
      : null;
    return { task, spawned, changed: update.changes > 0 };
  });
  if (result.changed) emit('tasks-changed');
  return result;
}

/** Compatibility wrapper. New callers should use completeTaskAndSpawnNext. */
export async function completeTask(id: string): Promise<void> {
  await completeTaskAndSpawnNext(id);
}

export async function spawnNextOccurrence(sourceTaskId: string): Promise<Task | null> {
  const db = await getDb();
  const spawned = await withExclusiveTransaction(db, (tx) =>
    spawnNextOccurrenceInTransaction(tx, sourceTaskId)
  );
  if (spawned) emit('tasks-changed');
  return spawned;
}

export async function uncompleteTask(id: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await withExclusiveTransaction(db, async (tx) => {
    const child = await tx.getFirstAsync<{ id: string; status: TaskStatus; created_at: number; updated_at: number }>(
      `SELECT id, status, created_at, updated_at FROM tasks
        WHERE parent_occurrence_id = ? AND deleted_at IS NULL`,
      [id]
    );
    if (child && child.status === 'pending' && child.created_at === child.updated_at) {
      await cascadeSoftDelete(tx, child.id, ts);
    }
    await tx.runAsync(
      `UPDATE tasks SET status = 'pending', completed_at = NULL, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL`,
      [ts, id]
    );
  });
  emit('tasks-changed');
}

export async function setPinned(id: string, pinned: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE tasks SET is_pinned = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [pinned ? 1 : 0, now(), id]
  );
  emit('tasks-changed');
}

async function cascadeSoftDelete(tx: SQLiteDatabase, id: string, ts: number): Promise<void> {
  await tx.runAsync(`UPDATE subtasks SET deleted_at = ?, updated_at = ? WHERE task_id = ? AND deleted_at IS NULL`, [ts, ts, id]);
  await tx.runAsync(`UPDATE task_reminders SET deleted_at = ?, updated_at = ? WHERE task_id = ? AND deleted_at IS NULL`, [ts, ts, id]);
  await tx.runAsync(`UPDATE task_repeat_rules SET deleted_at = ?, updated_at = ? WHERE task_id = ? AND deleted_at IS NULL`, [ts, ts, id]);
  await tx.runAsync(`UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`, [ts, ts, id]);
}

export async function softDeleteTask(id: string): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, (tx) => cascadeSoftDelete(tx, id, now()));
  emit('tasks-changed');
}

export async function restoreTask(id: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await withExclusiveTransaction(db, async (tx) => {
    const task = await getTaskByIdFrom(tx, id, true);
    if (!task || task.deletedAt === null) return;
    await tx.runAsync(`UPDATE tasks SET deleted_at = NULL, updated_at = ? WHERE id = ?`, [ts, id]);
    await tx.runAsync(
      `UPDATE subtasks SET deleted_at = NULL, updated_at = ? WHERE task_id = ? AND deleted_at = ?`,
      [ts, id, task.deletedAt]
    );
    await tx.runAsync(
      `UPDATE task_reminders SET deleted_at = NULL, updated_at = ?, schedule_state = 'pending'
        WHERE task_id = ? AND deleted_at = ?`,
      [ts, id, task.deletedAt]
    );
    await tx.runAsync(
      `UPDATE task_repeat_rules SET deleted_at = NULL, updated_at = ? WHERE task_id = ? AND deleted_at = ?`,
      [ts, id, task.deletedAt]
    );
  });
  emit('tasks-changed');
}

export async function permanentlyDeleteTask(id: string): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (tx) => {
    await tx.runAsync(`DELETE FROM task_repeat_rules WHERE task_id = ?`, [id]);
    await tx.runAsync(`DELETE FROM task_reminders WHERE task_id = ?`, [id]);
    await tx.runAsync(`DELETE FROM subtasks WHERE task_id = ?`, [id]);
    await tx.runAsync(`DELETE FROM tasks WHERE id = ? AND deleted_at IS NOT NULL`, [id]);
  });
  emit('tasks-changed');
}

export async function emptyTrash(): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (tx) => {
    const rows = await tx.getAllAsync<{ id: string }>(
      `SELECT id FROM tasks WHERE deleted_at IS NOT NULL`
    );
    for (const row of rows) {
      await tx.runAsync(`DELETE FROM task_repeat_rules WHERE task_id = ?`, [row.id]);
      await tx.runAsync(`DELETE FROM task_reminders WHERE task_id = ?`, [row.id]);
      await tx.runAsync(`DELETE FROM subtasks WHERE task_id = ?`, [row.id]);
    }
    await tx.runAsync(`DELETE FROM tasks WHERE deleted_at IS NOT NULL`);
  });
  emit('tasks-changed');
}
