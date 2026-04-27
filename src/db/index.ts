// Public surface for the persistence layer. Screens import from here only.

export { getDb } from './client';
export { newId } from './ids';
export { now } from './time';

export type {
  Category,
  Task,
  TaskStatus,
  Subtask,
  SubtaskStatus,
  Reminder,
  ReminderType,
  RepeatRule,
  RepeatFrequency,
} from './schema';

export {
  taskStatuses,
  subtaskStatuses,
  reminderTypes,
  repeatFrequencies,
} from './schema';

export * as categoriesRepo from './repos/categories';
export * as tasksRepo from './repos/tasks';
export * as subtasksRepo from './repos/subtasks';
export * as remindersRepo from './repos/reminders';
export * as repeatRulesRepo from './repos/repeatRules';
