import { z } from 'zod';
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
  taskStatuses,
  subtaskStatuses,
  reminderTypes,
  repeatFrequencies,
} from './schema';

export const BACKUP_FORMAT_VERSION = 1;

const backupCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.null(),
});

const backupTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string().nullable(),
  categoryId: z.string().nullable(),
  dueAt: z.number().int().nullable(),
  dueTime: z.number().int().nullable(),
  status: z.enum(taskStatuses),
  isPinned: z.boolean(),
  completedAt: z.number().int().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.null(),
});

const backupSubtaskSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  title: z.string(),
  status: z.enum(subtaskStatuses),
  sortOrder: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.null(),
});

const backupReminderSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  leadMinutes: z.number().int(),
  type: z.enum(reminderTypes),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.null(),
});

const backupRepeatRuleSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  freq: z.enum(repeatFrequencies),
  intervalN: z.number().int().min(1),
  byWeekday: z.string().nullable(),
  byMonthDay: z.number().int().nullable(),
  byMonth: z.number().int().nullable(),
  untilAt: z.number().int().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.null(),
});

export const backupJsonSchema = z.object({
  formatVersion: z.literal(BACKUP_FORMAT_VERSION),
  app: z.literal('streaktodo'),
  exportedAt: z.string(),
  schemaVersion: z.number().int().min(1),
  data: z.object({
    categories: z.array(backupCategorySchema),
    tasks: z.array(backupTaskSchema),
    subtasks: z.array(backupSubtaskSchema),
    reminders: z.array(backupReminderSchema),
    repeatRules: z.array(backupRepeatRuleSchema),
  }),
});

export type BackupJson = z.infer<typeof backupJsonSchema>;

export async function createBackupSnapshot(): Promise<BackupJson> {
  const db = await getDb();

  const [categoryRows, taskRows, subtaskRows, reminderRows, repeatRuleRows] = await Promise.all([
    db.getAllAsync<unknown>(
      `SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC`
    ),
    db.getAllAsync<unknown>(
      `SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY created_at ASC`
    ),
    db.getAllAsync<unknown>(
      `SELECT * FROM subtasks WHERE deleted_at IS NULL ORDER BY task_id ASC, sort_order ASC, created_at ASC`
    ),
    db.getAllAsync<unknown>(
      `SELECT * FROM task_reminders WHERE deleted_at IS NULL ORDER BY task_id ASC, lead_minutes DESC, created_at ASC`
    ),
    db.getAllAsync<unknown>(
      `SELECT * FROM task_repeat_rules WHERE deleted_at IS NULL ORDER BY task_id ASC, created_at ASC`
    ),
  ]);

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    app: 'streaktodo',
    exportedAt: new Date().toISOString(),
    schemaVersion: LATEST_MIGRATION_VERSION,
    data: {
      categories: categoryRows.map(categoryFromRow).map((row) => ({ ...row, deletedAt: null })),
      tasks: taskRows.map(taskFromRow).map((row) => ({ ...row, deletedAt: null })),
      subtasks: subtaskRows.map(subtaskFromRow).map((row) => ({ ...row, deletedAt: null })),
      reminders: reminderRows.map(reminderFromRow).map((row) => ({
        id: row.id,
        taskId: row.taskId,
        leadMinutes: row.leadMinutes,
        type: row.type,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: null,
      })),
      repeatRules: repeatRuleRows.map(repeatRuleFromRow).map((row) => ({ ...row, deletedAt: null })),
    },
  };
}

export async function createBackupJson(): Promise<string> {
  return JSON.stringify(await createBackupSnapshot(), null, 2);
}

export async function restoreBackupJson(raw: string): Promise<BackupJson> {
  const parsed = backupJsonSchema.parse(JSON.parse(raw));
  const db = await getDb();

  await db.withTransactionAsync(async () => {
    await clearAllTables(db);

    for (const c of parsed.data.categories) {
      await db.runAsync(
        `INSERT INTO categories
           (id, name, color, icon, is_default, sort_order, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [c.id, c.name, c.color, c.icon, c.isDefault ? 1 : 0, c.sortOrder, c.createdAt, c.updatedAt]
      );
    }

    for (const t of parsed.data.tasks) {
      await db.runAsync(
        `INSERT INTO tasks
           (id, title, notes, category_id, due_at, due_time, status, is_pinned, completed_at, sort_order, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          t.id,
          t.title,
          t.notes,
          t.categoryId,
          t.dueAt,
          t.dueTime,
          t.status,
          t.isPinned ? 1 : 0,
          t.completedAt,
          t.sortOrder,
          t.createdAt,
          t.updatedAt,
        ]
      );
    }

    for (const s of parsed.data.subtasks) {
      await db.runAsync(
        `INSERT INTO subtasks
           (id, task_id, title, status, sort_order, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
        [s.id, s.taskId, s.title, s.status, s.sortOrder, s.createdAt, s.updatedAt]
      );
    }

    for (const r of parsed.data.reminders) {
      await db.runAsync(
        `INSERT INTO task_reminders
           (id, task_id, lead_minutes, type, scheduled_notification_id, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, NULL)`,
        [r.id, r.taskId, r.leadMinutes, r.type, r.createdAt, r.updatedAt]
      );
    }

    for (const r of parsed.data.repeatRules) {
      await db.runAsync(
        `INSERT INTO task_repeat_rules
           (id, task_id, freq, interval_n, by_weekday, by_month_day, by_month, until_at, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          r.id,
          r.taskId,
          r.freq,
          r.intervalN,
          r.byWeekday,
          r.byMonthDay,
          r.byMonth,
          r.untilAt,
          r.createdAt,
          r.updatedAt,
        ]
      );
    }
  });

  emit('categories-changed');
  emit('tasks-changed');
  return parsed;
}

export async function resetLocalData(): Promise<void> {
  const db = await getDb();

  await db.withTransactionAsync(async () => {
    await clearAllTables(db);
  });

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
