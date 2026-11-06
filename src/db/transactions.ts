import type { SQLiteDatabase } from 'expo-sqlite';

/** Run native mutations on the transaction handle so unrelated writes cannot interleave. */
export async function withExclusiveTransaction<T>(
  db: SQLiteDatabase,
  task: (tx: SQLiteDatabase) => Promise<T>
): Promise<T> {
  let value: T | undefined;
  await db.withExclusiveTransactionAsync(async (tx) => {
    value = await task(tx);
  });
  return value as T;
}
