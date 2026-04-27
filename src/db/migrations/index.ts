import type { SQLiteDatabase } from 'expo-sqlite';
import { initialSchemaSql } from './001_initial';

// Migrations run in version order. Each migration is wrapped in its own
// transaction. user_version is bumped only after the migration succeeds.
type Migration = {
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
};

const migrations: Migration[] = [
  {
    version: 1,
    up: async (db) => {
      await db.execAsync(initialSchemaSql);
    },
  },
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  // Pragmas must be set before any statements that depend on them.
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync('PRAGMA journal_mode = WAL;');

  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version;'
  );
  let currentVersion = row?.user_version ?? 0;

  const pending = migrations
    .filter((m) => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const m of pending) {
    await db.withTransactionAsync(async () => {
      await m.up(db);
    });
    // PRAGMA can't take a parameter, so interpolate the trusted constant.
    await db.execAsync(`PRAGMA user_version = ${m.version};`);
    currentVersion = m.version;
  }
}

export const LATEST_MIGRATION_VERSION = migrations[migrations.length - 1]!.version;
