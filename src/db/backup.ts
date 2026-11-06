import { z } from 'zod';
import {
  dateKeyFromTimestamp,
  isCalendarDate,
  timestampFromDateKey,
  type CalendarDate,
} from '../lib/date';
import { getDb } from './client';
import { emit } from './events';
import { LATEST_MIGRATION_VERSION } from './migrations';
import { seedDefaultCategoriesIfEmpty } from './repos/categories';
import {
  categoryFromRow,
  repeatRuleFromRow,
  reminderFromRow,
  subtaskFromRow,
  taskFromRow,
  reminderTypes,
  repeatFrequencies,
  subtaskStatuses,
  taskStatuses,
} from './schema';
import { withExclusiveTransaction } from './transactions';

export const BACKUP_FORMAT_VERSION = 2;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

const id = z.string().min(1).max(200);
const nullableDate = z.string().refine(isCalendarDate, 'Invalid calendar date').nullable();
const nullableTimestamp = z.number().int().nonnegative().nullable();
const weekdayCsv = z.string().regex(/^(SU|MO|TU|WE|TH|FR|SA)(,(SU|MO|TU|WE|TH|FR|SA))*$/).nullable();

const categorySchema = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  color: z.string().max(32).nullable(),
  icon: z.string().max(80).nullable(),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  deletedAt: z.null(),
});

const taskV2Schema = z.object({
  id,
  title: z.string().trim().min(1).max(140),
  notes: z.string().max(1000).nullable(),
  categoryId: id.nullable(),
  dueDate: nullableDate,
  dueTime: z.number().int().min(0).max(1439).nullable(),
  status: z.enum(taskStatuses),
  isPinned: z.boolean(),
  completedAt: nullableTimestamp,
  sortOrder: z.number().int(),
  seriesId: id.nullable(),
  parentOccurrenceId: id.nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  deletedAt: z.null(),
});

const subtaskSchema = z.object({
  id,
  taskId: id,
  title: z.string().trim().min(1).max(120),
  status: z.enum(subtaskStatuses),
  sortOrder: z.number().int(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  deletedAt: z.null(),
});

const reminderSchema = z.object({
  id,
  taskId: id,
  leadMinutes: z.number().int().min(0).max(525_600),
  type: z.enum(reminderTypes),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  deletedAt: z.null(),
});

const repeatRuleV2Schema = z.object({
  id,
  taskId: id,
  freq: z.enum(repeatFrequencies),
  intervalN: z.number().int().min(1).max(999),
  byWeekday: weekdayCsv,
  byMonthDay: z.number().int().min(1).max(31).nullable(),
  byMonth: z.number().int().min(1).max(12).nullable(),
  anchorDate: nullableDate,
  untilDate: nullableDate,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  deletedAt: z.null(),
});

const dataLimits = {
  categories: 500,
  tasks: 50_000,
  subtasks: 200_000,
  reminders: 100_000,
  repeatRules: 50_000,
} as const;

export const backupJsonSchema = z.object({
  formatVersion: z.literal(BACKUP_FORMAT_VERSION),
  app: z.literal('streaktodo'),
  exportedAt: z.string().datetime(),
  schemaVersion: z.number().int().min(1).max(LATEST_MIGRATION_VERSION),
  data: z.object({
    categories: z.array(categorySchema).max(dataLimits.categories),
    tasks: z.array(taskV2Schema).max(dataLimits.tasks),
    subtasks: z.array(subtaskSchema).max(dataLimits.subtasks),
    reminders: z.array(reminderSchema).max(dataLimits.reminders),
    repeatRules: z.array(repeatRuleV2Schema).max(dataLimits.repeatRules),
  }),
});

export type BackupJson = z.infer<typeof backupJsonSchema>;

// V1 is accepted only so existing user-created backups remain recoverable.
const taskV1Schema = taskV2Schema.omit({ dueDate: true, seriesId: true, parentOccurrenceId: true }).extend({
  dueAt: nullableTimestamp,
  dueTime: z.number().int().min(0).max(1439).nullable(),
});
const repeatRuleV1Schema = repeatRuleV2Schema.omit({ anchorDate: true, untilDate: true }).extend({
  untilAt: nullableTimestamp,
});
const backupV1Schema = z.object({
  formatVersion: z.literal(1),
  app: z.literal('streaktodo'),
  exportedAt: z.string().datetime(),
  schemaVersion: z.number().int().min(1).max(LATEST_MIGRATION_VERSION),
  data: z.object({
    categories: z.array(categorySchema).max(dataLimits.categories),
    tasks: z.array(taskV1Schema).max(dataLimits.tasks),
    subtasks: z.array(subtaskSchema).max(dataLimits.subtasks),
    reminders: z.array(reminderSchema).max(dataLimits.reminders),
    repeatRules: z.array(repeatRuleV1Schema).max(dataLimits.repeatRules),
  }),
});

function assertUnique(rows: ReadonlyArray<{ id: string }>, label: string): void {
  const ids = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.id)) throw new Error(`Backup contains duplicate ${label} id: ${row.id}`);
    ids.add(row.id);
  }
}

function validateReferences(backup: BackupJson): BackupJson {
  const { categories, tasks, subtasks, reminders, repeatRules } = backup.data;
  assertUnique(categories, 'category');
  assertUnique(tasks, 'task');
  assertUnique(subtasks, 'subtask');
  assertUnique(reminders, 'reminder');
  assertUnique(repeatRules, 'repeat rule');

  const categoryIds = new Set(categories.map((row) => row.id));
  const taskIds = new Set(tasks.map((row) => row.id));
  for (const task of tasks) {
    if (task.categoryId && !categoryIds.has(task.categoryId)) {
      throw new Error(`Task “${task.title}” references a missing category.`);
    }
    if (task.parentOccurrenceId && !taskIds.has(task.parentOccurrenceId)) {
      throw new Error(`Task “${task.title}” references a missing prior occurrence.`);
    }
    if (task.parentOccurrenceId === task.id) {
      throw new Error(`Task “${task.title}” cannot be its own prior occurrence.`);
    }
    if (task.dueDate === null && task.dueTime !== null) {
      throw new Error(`Task “${task.title}” has a time but no date.`);
    }
    if (
      (task.status === 'done' && task.completedAt === null) ||
      (task.status !== 'done' && task.completedAt !== null)
    ) {
      throw new Error(`Task “${task.title}” has inconsistent completion data.`);
    }
  }
  for (const row of [...subtasks, ...reminders, ...repeatRules]) {
    if (!taskIds.has(row.taskId)) throw new Error('Backup contains an item whose task is missing.');
  }
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  for (const reminder of reminders) {
    if (!taskById.get(reminder.taskId)?.dueDate) {
      throw new Error('Backup contains a reminder for a task without a date.');
    }
  }
  const repeatTaskIds = new Set<string>();
  for (const rule of repeatRules) {
    if (repeatTaskIds.has(rule.taskId)) throw new Error('Backup contains multiple repeat rules for one task.');
    const task = taskById.get(rule.taskId);
    if (!task?.dueDate) throw new Error('Backup contains a repeat rule for a task without a date.');
    const anchor = rule.anchorDate ?? task.dueDate;
    if (rule.untilDate && rule.untilDate < anchor) {
      throw new Error(`Repeat rule for “${task.title}” ends before it starts.`);
    }
    repeatTaskIds.add(rule.taskId);
  }
  return backup;
}

function normalizeV1(value: z.infer<typeof backupV1Schema>): BackupJson {
  const repeatByTask = new Map(value.data.repeatRules.map((rule) => [rule.taskId, rule]));
  const tasks = value.data.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    notes: task.notes,
    categoryId: task.categoryId,
    dueDate: task.dueAt === null ? null : dateKeyFromTimestamp(task.dueAt),
    dueTime: task.dueTime,
    status: task.status,
    isPinned: task.isPinned,
    completedAt: task.completedAt,
    sortOrder: task.sortOrder,
    seriesId: repeatByTask.has(task.id) ? task.id : null,
    parentOccurrenceId: null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    deletedAt: null as null,
  }));
  const dueByTask = new Map(tasks.map((task) => [task.id, task.dueDate]));
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    app: 'streaktodo',
    exportedAt: value.exportedAt,
    schemaVersion: LATEST_MIGRATION_VERSION,
    data: {
      categories: value.data.categories,
      tasks,
      subtasks: value.data.subtasks,
      reminders: value.data.reminders,
      repeatRules: value.data.repeatRules.map((rule) => ({
        id: rule.id,
        taskId: rule.taskId,
        freq: rule.freq,
        intervalN: rule.intervalN,
        byWeekday: rule.byWeekday,
        byMonthDay: rule.byMonthDay,
        byMonth: rule.byMonth,
        anchorDate: dueByTask.get(rule.taskId) ?? null,
        untilDate: rule.untilAt === null ? null : dateKeyFromTimestamp(rule.untilAt),
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
        deletedAt: null,
      })),
    },
  };
}

export function parseBackupJson(raw: string): BackupJson {
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) {
    throw new Error('Backup is larger than 5 MB. Split or reduce it before importing.');
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('This file is not valid JSON. Choose a Streak Todo backup.');
  }
  const version = typeof json === 'object' && json !== null && 'formatVersion' in json
    ? (json as { formatVersion?: unknown }).formatVersion
    : null;
  if (typeof version === 'number' && version > BACKUP_FORMAT_VERSION) {
    throw new Error('This backup was created by a newer Streak Todo version. Update the app before importing it.');
  }
  if (version !== 1 && version !== BACKUP_FORMAT_VERSION) {
    throw new Error('This is not a supported Streak Todo backup.');
  }

  try {
    const normalized = version === 1
      ? normalizeV1(backupV1Schema.parse(json))
      : backupJsonSchema.parse(json);
    return validateReferences(backupJsonSchema.parse(normalized));
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      const location = issue?.path.length ? ` at ${issue.path.join('.')}` : '';
      throw new Error(`This backup has invalid data${location}${issue ? `: ${issue.message}` : '.'}`);
    }
    throw error;
  }
}

export async function createBackupSnapshot(): Promise<BackupJson> {
  const db = await getDb();
  const [categoryRows, taskRows, subtaskRows, reminderRows, repeatRuleRows] = await Promise.all([
    db.getAllAsync<unknown>(`SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY sort_order, created_at`),
    db.getAllAsync<unknown>(`SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY created_at`),
    db.getAllAsync<unknown>(
      `SELECT s.* FROM subtasks s JOIN tasks t ON t.id = s.task_id
        WHERE s.deleted_at IS NULL AND t.deleted_at IS NULL ORDER BY s.task_id, s.sort_order, s.created_at`
    ),
    db.getAllAsync<unknown>(
      `SELECT r.* FROM task_reminders r JOIN tasks t ON t.id = r.task_id
        WHERE r.deleted_at IS NULL AND t.deleted_at IS NULL ORDER BY r.task_id, r.lead_minutes DESC`
    ),
    db.getAllAsync<unknown>(
      `SELECT r.* FROM task_repeat_rules r JOIN tasks t ON t.id = r.task_id
        WHERE r.deleted_at IS NULL AND t.deleted_at IS NULL ORDER BY r.task_id`
    ),
  ]);
  const categories = categoryRows.map(categoryFromRow).map((row) => ({ ...row, deletedAt: null as null }));
  const categoryIds = new Set(categories.map((row) => row.id));
  const tasks = taskRows.map(taskFromRow);
  const taskIds = new Set(tasks.map((row) => row.id));
  const snapshot: BackupJson = {
    formatVersion: BACKUP_FORMAT_VERSION,
    app: 'streaktodo',
    exportedAt: new Date().toISOString(),
    schemaVersion: LATEST_MIGRATION_VERSION,
    data: {
      categories,
      tasks: tasks.map((row) => ({
        id: row.id,
        title: row.title,
        notes: row.notes,
        categoryId: row.categoryId && categoryIds.has(row.categoryId) ? row.categoryId : null,
        dueDate: row.dueDate,
        dueTime: row.dueDate ? row.dueTime : null,
        status: row.status,
        isPinned: row.isPinned,
        // Repair legacy status/timestamp drift in the exported copy without
        // mutating the user's live database.
        completedAt: row.status === 'done' ? (row.completedAt ?? row.updatedAt) : null,
        sortOrder: row.sortOrder,
        seriesId: row.seriesId,
        parentOccurrenceId:
          row.parentOccurrenceId && taskIds.has(row.parentOccurrenceId)
            ? row.parentOccurrenceId
            : null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: null,
      })),
      subtasks: subtaskRows.map(subtaskFromRow).map((row) => ({ ...row, deletedAt: null as null })),
      reminders: reminderRows.map(reminderFromRow).map((row) => ({
        id: row.id,
        taskId: row.taskId,
        leadMinutes: row.leadMinutes,
        type: row.type,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: null,
      })),
      repeatRules: repeatRuleRows.map(repeatRuleFromRow).map((row) => ({
        id: row.id,
        taskId: row.taskId,
        freq: row.freq,
        intervalN: row.intervalN,
        byWeekday: row.byWeekday,
        byMonthDay: row.byMonthDay,
        byMonth: row.byMonth,
        anchorDate: row.anchorDate,
        untilDate: row.untilDate,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: null,
      })),
    },
  };
  return validateReferences(backupJsonSchema.parse(snapshot));
}

export async function createBackupJson(): Promise<string> {
  return JSON.stringify(await createBackupSnapshot(), null, 2);
}

export async function restoreBackupJson(raw: string): Promise<BackupJson> {
  const parsed = parseBackupJson(raw);
  const db = await getDb();
  await withExclusiveTransaction(db, async (tx) => {
    await clearAllTables(tx);
    for (const row of parsed.data.categories) {
      await tx.runAsync(
        `INSERT INTO categories
           (id, name, color, icon, is_default, sort_order, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [row.id, row.name, row.color, row.icon, row.isDefault ? 1 : 0, row.sortOrder, row.createdAt, row.updatedAt]
      );
    }
    for (const row of parsed.data.tasks) {
      await tx.runAsync(
        `INSERT INTO tasks
           (id, title, notes, category_id, due_at, due_date, due_time, status,
            is_pinned, completed_at, sort_order, created_at, updated_at,
            deleted_at, series_id, parent_occurrence_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        [
          row.id, row.title, row.notes, row.categoryId,
          row.dueDate ? timestampFromDateKey(row.dueDate) : null, row.dueDate,
          row.dueTime, row.status, row.isPinned ? 1 : 0, row.completedAt,
          row.sortOrder, row.createdAt, row.updatedAt, row.seriesId,
          row.parentOccurrenceId,
        ]
      );
    }
    for (const row of parsed.data.subtasks) {
      await tx.runAsync(
        `INSERT INTO subtasks
           (id, task_id, title, status, sort_order, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
        [row.id, row.taskId, row.title, row.status, row.sortOrder, row.createdAt, row.updatedAt]
      );
    }
    for (const row of parsed.data.reminders) {
      await tx.runAsync(
        `INSERT INTO task_reminders
           (id, task_id, lead_minutes, type, scheduled_notification_id,
            schedule_state, schedule_error, scheduled_for, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, NULL, 'pending', NULL, NULL, ?, ?, NULL)`,
        [row.id, row.taskId, row.leadMinutes, row.type, row.createdAt, row.updatedAt]
      );
    }
    for (const row of parsed.data.repeatRules) {
      await tx.runAsync(
        `INSERT INTO task_repeat_rules
           (id, task_id, freq, interval_n, by_weekday, by_month_day, by_month,
            until_at, anchor_date, until_date, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          row.id, row.taskId, row.freq, row.intervalN, row.byWeekday,
          row.byMonthDay, row.byMonth,
          row.untilDate ? timestampFromDateKey(row.untilDate) : null,
          row.anchorDate, row.untilDate, row.createdAt, row.updatedAt,
        ]
      );
    }
  });
  await seedDefaultCategoriesIfEmpty(db);
  emit('categories-changed');
  emit('tasks-changed');
  return parsed;
}

export async function resetLocalData(): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, clearAllTables);
  await seedDefaultCategoriesIfEmpty(db);
  emit('categories-changed');
  emit('tasks-changed');
}

async function clearAllTables(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  await db.runAsync(`DELETE FROM task_repeat_rules`);
  await db.runAsync(`DELETE FROM task_reminders`);
  await db.runAsync(`DELETE FROM subtasks`);
  await db.runAsync(`DELETE FROM tasks`);
  await db.runAsync(`DELETE FROM categories`);
}
