// Initial schema. Sync-safe from day one:
//   - stable string ids (uuid v4) on every row
//   - created_at, updated_at on every mutable table (epoch millis)
//   - deleted_at (nullable) for soft-delete on synced tables
// All tables are STRICT so SQLite enforces declared types.

export const initialSchemaSql = `
  CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL,
    color       TEXT,
    icon        TEXT,
    is_default  INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_categories_deleted_at
    ON categories(deleted_at);

  CREATE TABLE IF NOT EXISTS tasks (
    id            TEXT PRIMARY KEY NOT NULL,
    title         TEXT NOT NULL,
    notes         TEXT,
    category_id   TEXT REFERENCES categories(id) ON DELETE SET NULL,
    due_at        INTEGER,             -- epoch millis at start of due day, null = no date
    due_time      INTEGER,             -- minutes since midnight (0..1439), null = all-day
    status        TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','done','skipped')),
    is_pinned     INTEGER NOT NULL DEFAULT 0,
    completed_at  INTEGER,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    deleted_at    INTEGER
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_tasks_due_at        ON tasks(due_at);
  CREATE INDEX IF NOT EXISTS idx_tasks_category_id   ON tasks(category_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_status        ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at    ON tasks(deleted_at);

  CREATE TABLE IF NOT EXISTS subtasks (
    id          TEXT PRIMARY KEY NOT NULL,
    task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','done')),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    deleted_at  INTEGER
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_subtasks_task_id     ON subtasks(task_id);
  CREATE INDEX IF NOT EXISTS idx_subtasks_deleted_at  ON subtasks(deleted_at);

  -- 1-to-many: a task may have multiple reminders (e.g. 15 min before + at time).
  CREATE TABLE IF NOT EXISTS task_reminders (
    id                          TEXT PRIMARY KEY NOT NULL,
    task_id                     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    lead_minutes                INTEGER NOT NULL DEFAULT 0,    -- 0 = at time
    type                        TEXT NOT NULL DEFAULT 'notification'
                                  CHECK (type IN ('notification','silent','alarm')),
    scheduled_notification_id   TEXT,                          -- expo-notifications id, populated when scheduled
    created_at                  INTEGER NOT NULL,
    updated_at                  INTEGER NOT NULL,
    deleted_at                  INTEGER
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_reminders_task_id     ON task_reminders(task_id);
  CREATE INDEX IF NOT EXISTS idx_reminders_deleted_at  ON task_reminders(deleted_at);

  -- 1-to-1 (or none): a task may carry one repeat rule.
  CREATE TABLE IF NOT EXISTS task_repeat_rules (
    id            TEXT PRIMARY KEY NOT NULL,
    task_id       TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
    freq          TEXT NOT NULL
                    CHECK (freq IN ('daily','weekly','monthly','yearly','custom')),
    interval_n    INTEGER NOT NULL DEFAULT 1,                -- e.g. every 2 weeks
    by_weekday    TEXT,                                       -- comma-separated, MO,TU,WE,...
    by_month_day  INTEGER,
    by_month      INTEGER,
    until_at      INTEGER,                                    -- epoch millis end (inclusive), null = forever
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    deleted_at    INTEGER
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_repeat_rules_task_id     ON task_repeat_rules(task_id);
  CREATE INDEX IF NOT EXISTS idx_repeat_rules_deleted_at  ON task_repeat_rules(deleted_at);
`;
