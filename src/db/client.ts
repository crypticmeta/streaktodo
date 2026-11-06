import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { runMigrations } from './migrations';
import { seedDefaultCategoriesIfEmpty } from './repos/categories';

const DB_NAME = 'streaktodo.db';

let dbPromise: Promise<SQLiteDatabase> | null = null;

// Singleton accessor. The first call opens the database, runs migrations,
// and seeds defaults. Every subsequent call returns the same handle.
export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    const attempt = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      try {
        await runMigrations(db);
        await seedDefaultCategoriesIfEmpty(db);
        return db;
      } catch (error) {
        await db.closeAsync().catch(() => {});
        throw error;
      }
    })();
    dbPromise = attempt;
    void attempt.catch(() => {
      // A rejected promise must not poison the singleton forever. The error
      // screen's Retry action can now perform a genuine fresh open.
      if (dbPromise === attempt) dbPromise = null;
    });
  }
  return dbPromise;
}

// Test helper — closes and forgets the singleton. Not exported beyond db/.
export async function _resetDbForTesting(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    await db.closeAsync();
    dbPromise = null;
  }
}
