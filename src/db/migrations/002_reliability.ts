/**
 * Reliability schema:
 * - stable local-date keys for timezone-safe calendar concepts
 * - recurrence series/occurrence identity for idempotent spawning
 * - explicit recurrence anchor unit data
 * - durable reminder scheduling health
 * - partial indexes for the app's active-row query shapes
 */
export const reliabilitySchemaSql = `
  ALTER TABLE tasks ADD COLUMN due_date TEXT;
  ALTER TABLE tasks ADD COLUMN series_id TEXT;
  ALTER TABLE tasks ADD COLUMN parent_occurrence_id TEXT;

  UPDATE tasks
     SET due_date = strftime('%Y-%m-%d', due_at / 1000, 'unixepoch', 'localtime')
   WHERE due_at IS NOT NULL AND due_date IS NULL;

  UPDATE tasks
     SET series_id = id
   WHERE series_id IS NULL
     AND id IN (
       SELECT task_id FROM task_repeat_rules WHERE deleted_at IS NULL
     );

  ALTER TABLE task_repeat_rules ADD COLUMN anchor_date TEXT;
  ALTER TABLE task_repeat_rules ADD COLUMN until_date TEXT;

  UPDATE task_repeat_rules
     SET anchor_date = (
       SELECT due_date FROM tasks WHERE tasks.id = task_repeat_rules.task_id
     )
   WHERE anchor_date IS NULL;

  UPDATE task_repeat_rules
     SET until_date = strftime('%Y-%m-%d', until_at / 1000, 'unixepoch', 'localtime')
   WHERE until_at IS NOT NULL AND until_date IS NULL;

  ALTER TABLE task_reminders ADD COLUMN schedule_state TEXT NOT NULL DEFAULT 'pending';
  ALTER TABLE task_reminders ADD COLUMN schedule_error TEXT;
  ALTER TABLE task_reminders ADD COLUMN scheduled_for INTEGER;

  UPDATE tasks
     SET category_id = NULL
   WHERE category_id IN (
     SELECT id FROM categories WHERE deleted_at IS NOT NULL
   );

  UPDATE subtasks
     SET deleted_at = COALESCE(
       deleted_at,
       (SELECT deleted_at FROM tasks WHERE tasks.id = subtasks.task_id)
     )
   WHERE task_id IN (SELECT id FROM tasks WHERE deleted_at IS NOT NULL);

  UPDATE task_reminders
     SET deleted_at = COALESCE(
       deleted_at,
       (SELECT deleted_at FROM tasks WHERE tasks.id = task_reminders.task_id)
     )
   WHERE task_id IN (SELECT id FROM tasks WHERE deleted_at IS NOT NULL);

  UPDATE task_repeat_rules
     SET deleted_at = COALESCE(
       deleted_at,
       (SELECT deleted_at FROM tasks WHERE tasks.id = task_repeat_rules.task_id)
     )
   WHERE task_id IN (SELECT id FROM tasks WHERE deleted_at IS NOT NULL);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_active_parent_occurrence
    ON tasks(parent_occurrence_id)
    WHERE parent_occurrence_id IS NOT NULL AND deleted_at IS NULL;

  CREATE INDEX IF NOT EXISTS idx_tasks_active_status_due
    ON tasks(status, due_date, due_time, is_pinned)
    WHERE deleted_at IS NULL;

  CREATE INDEX IF NOT EXISTS idx_tasks_active_category_status
    ON tasks(category_id, status, due_date)
    WHERE deleted_at IS NULL;

  CREATE INDEX IF NOT EXISTS idx_subtasks_active_task
    ON subtasks(task_id, sort_order)
    WHERE deleted_at IS NULL;

  CREATE INDEX IF NOT EXISTS idx_reminders_active_task
    ON task_reminders(task_id, lead_minutes)
    WHERE deleted_at IS NULL;

  CREATE INDEX IF NOT EXISTS idx_repeat_rules_active_task
    ON task_repeat_rules(task_id)
    WHERE deleted_at IS NULL;
`;
