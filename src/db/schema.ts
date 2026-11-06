import { z } from 'zod';
import { timestampFromDateKey, type CalendarDate } from '../lib/date';

// ─── Enums ──────────────────────────────────────────────────────────────

export const taskStatuses = ['pending', 'done', 'skipped'] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const subtaskStatuses = ['pending', 'done'] as const;
export type SubtaskStatus = (typeof subtaskStatuses)[number];

export const reminderTypes = ['notification', 'silent', 'alarm'] as const;
export type ReminderType = (typeof reminderTypes)[number];

export const reminderScheduleStates = [
  'pending',
  'scheduled',
  'permission_denied',
  'invalid',
  'error',
] as const;
export type ReminderScheduleState = (typeof reminderScheduleStates)[number];

export const repeatFrequencies = ['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const;
export type RepeatFrequency = (typeof repeatFrequencies)[number];

// ─── Row schemas (raw SQLite shape) ─────────────────────────────────────
// SQLite returns 0/1 for booleans and NULL for null. Parsers normalize to
// JS booleans / `null`. Use these parsers at every read boundary; never
// trust a raw row in business logic.

const sqliteBool = z.union([z.literal(0), z.literal(1)]).transform((v) => v === 1);

export const categoryRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  is_default: sqliteBool,
  sort_order: z.number().int(),
  created_at: z.number().int(),
  updated_at: z.number().int(),
  deleted_at: z.number().int().nullable(),
});

export const taskRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string().nullable(),
  category_id: z.string().nullable(),
  due_at: z.number().int().nullable(),
  due_date: z.string().nullable(),
  due_time: z.number().int().min(0).max(1439).nullable(),
  status: z.enum(taskStatuses),
  is_pinned: sqliteBool,
  completed_at: z.number().int().nullable(),
  sort_order: z.number().int(),
  created_at: z.number().int(),
  updated_at: z.number().int(),
  deleted_at: z.number().int().nullable(),
  series_id: z.string().nullable(),
  parent_occurrence_id: z.string().nullable(),
});

export const subtaskRowSchema = z.object({
  id: z.string(),
  task_id: z.string(),
  title: z.string(),
  status: z.enum(subtaskStatuses),
  sort_order: z.number().int(),
  created_at: z.number().int(),
  updated_at: z.number().int(),
  deleted_at: z.number().int().nullable(),
});

export const reminderRowSchema = z.object({
  id: z.string(),
  task_id: z.string(),
  lead_minutes: z.number().int(),
  type: z.enum(reminderTypes),
  scheduled_notification_id: z.string().nullable(),
  schedule_state: z.enum(reminderScheduleStates),
  schedule_error: z.string().nullable(),
  scheduled_for: z.number().int().nullable(),
  created_at: z.number().int(),
  updated_at: z.number().int(),
  deleted_at: z.number().int().nullable(),
});

export const repeatRuleRowSchema = z.object({
  id: z.string(),
  task_id: z.string(),
  freq: z.enum(repeatFrequencies),
  interval_n: z.number().int().min(1),
  by_weekday: z.string().nullable(),
  by_month_day: z.number().int().nullable(),
  by_month: z.number().int().nullable(),
  until_at: z.number().int().nullable(),
  anchor_date: z.string().nullable(),
  until_date: z.string().nullable(),
  created_at: z.number().int(),
  updated_at: z.number().int(),
  deleted_at: z.number().int().nullable(),
});

// ─── Domain types (camelCase) ───────────────────────────────────────────
// These are what the rest of the app sees. Repos transform rows → domain.

export type Category = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  categoryId: string | null;
  dueAt: number | null;
  dueDate: CalendarDate | null;
  dueTime: number | null;
  status: TaskStatus;
  isPinned: boolean;
  completedAt: number | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  seriesId: string | null;
  parentOccurrenceId: string | null;
};

export type Subtask = {
  id: string;
  taskId: string;
  title: string;
  status: SubtaskStatus;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type Reminder = {
  id: string;
  taskId: string;
  leadMinutes: number;
  type: ReminderType;
  scheduledNotificationId: string | null;
  scheduleState: ReminderScheduleState;
  scheduleError: string | null;
  scheduledFor: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type RepeatRule = {
  id: string;
  taskId: string;
  freq: RepeatFrequency;
  intervalN: number;
  byWeekday: string | null;
  byMonthDay: number | null;
  byMonth: number | null;
  untilAt: number | null;
  anchorDate: CalendarDate | null;
  untilDate: CalendarDate | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

// ─── Row → domain mappers ───────────────────────────────────────────────

export function categoryFromRow(raw: unknown): Category {
  const r = categoryRowSchema.parse(raw);
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    icon: r.icon,
    isDefault: r.is_default,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

export function taskFromRow(raw: unknown): Task {
  const r = taskRowSchema.parse(raw);
  const dueDate = r.due_date as CalendarDate | null;
  return {
    id: r.id,
    title: r.title,
    notes: r.notes,
    categoryId: r.category_id,
    dueAt: dueDate ? timestampFromDateKey(dueDate) : r.due_at,
    dueDate,
    dueTime: r.due_time,
    status: r.status,
    isPinned: r.is_pinned,
    completedAt: r.completed_at,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    seriesId: r.series_id,
    parentOccurrenceId: r.parent_occurrence_id,
  };
}

export function subtaskFromRow(raw: unknown): Subtask {
  const r = subtaskRowSchema.parse(raw);
  return {
    id: r.id,
    taskId: r.task_id,
    title: r.title,
    status: r.status,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

export function reminderFromRow(raw: unknown): Reminder {
  const r = reminderRowSchema.parse(raw);
  return {
    id: r.id,
    taskId: r.task_id,
    leadMinutes: r.lead_minutes,
    type: r.type,
    scheduledNotificationId: r.scheduled_notification_id,
    scheduleState: r.schedule_state,
    scheduleError: r.schedule_error,
    scheduledFor: r.scheduled_for,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

export function repeatRuleFromRow(raw: unknown): RepeatRule {
  const r = repeatRuleRowSchema.parse(raw);
  const anchorDate = r.anchor_date as CalendarDate | null;
  const untilDate = r.until_date as CalendarDate | null;
  return {
    id: r.id,
    taskId: r.task_id,
    freq: r.freq,
    intervalN: r.interval_n,
    byWeekday: r.by_weekday,
    byMonthDay: r.by_month_day,
    byMonth: r.by_month,
    untilAt: untilDate ? timestampFromDateKey(untilDate) : r.until_at,
    anchorDate,
    untilDate,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}
