#!/usr/bin/env bash
set -euo pipefail

fixture_dir="$(mktemp -d /tmp/streaktodo-migration.XXXXXX)"
trap 'rm -rf "$fixture_dir"' EXIT

node scripts/build-migration-fixture.mjs > "$fixture_dir/migration.sql"
sqlite3 "$fixture_dir/test.db" < "$fixture_dir/migration.sql"

actual="$(sqlite3 -separator '|' "$fixture_dir/test.db" \
  "SELECT due_date = '2026-08-11', series_id = 'task',
          (SELECT anchor_date FROM task_repeat_rules WHERE task_id = 'task') = '2026-08-11',
          (SELECT deleted_at FROM subtasks WHERE id = 'sub') IS NOT NULL
     FROM tasks WHERE id = 'task';")"

if [[ "$actual" != "1|1|1|1" ]]; then
  echo "Migration verification failed: $actual" >&2
  exit 1
fi

echo "Migration verification passed."
