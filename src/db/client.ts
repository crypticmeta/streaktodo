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
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await runMigrations(db);
      await seedDefaultCategoriesIfEmpty(db);
      return db;
    })();
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
