# Persistence migration plan

This file documents the policy around schema changes for the SQLite database
shipped with the app. The infrastructure lives in `src/db/migrations/index.ts`
and uses SQLite's built-in `PRAGMA user_version` to track which migrations
have already run on a given device.

## When to add a new migration

Anything that changes the **shape** of the on-disk schema needs a migration:

- New table
- New column on an existing table
- New index
- New `CHECK` constraint or `NOT NULL` constraint
- Column rename or type change (these are SQLite-painful — see "Hard cases")
- Dropping or renaming a table

Things that **do not** need a migration:

- Default category seeding — handled separately in `seedDefaultCategoriesIfEmpty`
- Code-level changes to how existing data is interpreted (TypeScript enum
  expansion, new derived fields computed in JS) — these are JS-only

## How to add one

1. Create `NNN_descriptive_name.ts` next to `001_initial.ts`. Use the next
   integer (`002_…`, `003_…`). Versions are dense — never skip numbers.
2. Export the SQL or async function. Prefer raw SQL strings for forward
   migrations because they are easy to read in diffs.
3. Append a new entry to the `migrations` array in `migrations/index.ts`,
   in version order. Do **not** reorder existing entries.
4. Test on a populated device by sideloading the new build over the old one
   without uninstalling — that's the actual upgrade path users will take.

## Safety rules

The migration framework wraps each migration in a transaction and only bumps
`user_version` after it commits. This means:

- **A failed migration leaves the device on the previous version.** It will
  retry on next launch. Make migrations idempotent where you can (e.g.,
  `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) so a partial
  write that somehow escapes the transaction can heal itself.
- **Never edit a migration file after it has shipped to a real user.** Its
  job is to describe the *exact* set of statements that must run on each
  device. Editing it would mean different devices end up with different
  schemas while reporting the same `user_version`. Instead, add a new
  migration that fixes the issue.
- **Do not write code that depends on a migration *and* is part of the
  migration.** Migrations run before any repo code. They should use raw
  SQL only — no calls into `tasksRepo`, `categoriesRepo`, etc. Those repos
  may assume schema state that doesn't exist yet during the migration.

## Hard cases

### Adding a NOT NULL column

SQLite requires either a `DEFAULT` value or that the table be empty. For our
case (live user data), always supply a `DEFAULT`:

```sql
ALTER TABLE tasks ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
```

If the right value isn't a literal default, do it in two phases:

1. Migration N: add the column as nullable with no default
2. Migration N: backfill via `UPDATE tasks SET priority = …`
3. Migration N+1 (next release): tighten to NOT NULL by rebuilding the table
   (see below). Don't try to combine — the rebuild is expensive enough that
   it deserves to be a separate, isolated step.

### Renaming or dropping a column

SQLite ≥ 3.25 supports `ALTER TABLE … RENAME COLUMN` and ≥ 3.35 supports
`DROP COLUMN`. expo-sqlite ships modern SQLite, so prefer those. Fall back
to the rebuild dance only if you hit a constraint the modern syntax can't
express (e.g., reordering columns, which we never need).

### Changing a column's type or constraint

SQLite cannot change a column's type or its NOT NULL status in place. The
fix is a rebuild:

```sql
CREATE TABLE tasks_new (…new shape…);
INSERT INTO tasks_new SELECT … FROM tasks;
DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;
-- Re-create any indexes and triggers that pointed at the old table.
```

Wrap the whole sequence in the migration function so it's one transaction.

## Versioning compatibility

The app loads `LATEST_MIGRATION_VERSION` and runs every pending migration
before the rest of the app boots. There is no compatibility window — a user
who skips a release simply runs every missed migration the next time they
open the app. The cost is one-time, on first open of the new build.

We do not currently support **downgrades**. If a user installs an older
build over a newer one, the database will be on a higher `user_version` than
the older code expects, and the older code may try to read columns that no
longer exist or write rows that violate newer constraints. Until we ship
backup/restore (Phase 14), the policy is: **forward-only**. A signed test
build that can't be downgraded is fine; once we ship to the Play Store,
release tracks already enforce monotonic version codes.

## Why no ORM

Raw SQL keeps the migration story honest. ORM-driven schema generation tends
to produce migrations by *diffing model files against a snapshot*, which is
fine until two engineers commit conflicting model changes and the diff
generator silently picks one. With raw SQL, every schema change is an
explicit human decision visible in `git log`.

## Testing checklist before merging a migration

- [ ] Build with the new migration on top of an existing populated database
      (do **not** wipe the app between runs)
- [ ] Confirm the new migration runs exactly once on first launch and is
      a no-op on subsequent launches
- [ ] Confirm `PRAGMA user_version` advances to the new latest version
- [ ] Confirm no existing repo function silently breaks (run the app, exercise
      task create / edit / delete / complete paths)
- [ ] If the migration changes a column read by an existing query, search
      the repos for that column name and update the query at the same time
