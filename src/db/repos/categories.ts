import type { SQLiteDatabase } from 'expo-sqlite';
import { getDb } from '../client';
import { emit } from '../events';
import { newId } from '../ids';
import { now } from '../time';
import { categoryFromRow, type Category } from '../schema';

// Stable IDs so default categories survive across reinstalls / restores.
export const DEFAULT_CATEGORY_IDS = {
  work: 'cat-default-work',
  personal: 'cat-default-personal',
  wishlist: 'cat-default-wishlist',
} as const;

const DEFAULTS: ReadonlyArray<{ id: string; name: string; color: string; icon: string; sortOrder: number }> = [
  { id: DEFAULT_CATEGORY_IDS.work,     name: 'Work',     color: '#3f7e69', icon: 'briefcase', sortOrder: 0 },
  { id: DEFAULT_CATEGORY_IDS.personal, name: 'Personal', color: '#b58a3d', icon: 'user',      sortOrder: 1 },
  { id: DEFAULT_CATEGORY_IDS.wishlist, name: 'Wishlist', color: '#8a1d1d', icon: 'star',      sortOrder: 2 },
];

export type CreateCategoryInput = {
  name: string;
  color?: string | null;
  icon?: string | null;
  sortOrder?: number;
};

export type UpdateCategoryInput = {
  name?: string;
  color?: string | null;
  icon?: string | null;
  sortOrder?: number;
};

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<unknown>(
    `SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC`
  );
  return rows.map(categoryFromRow);
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<unknown>(
    `SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return row ? categoryFromRow(row) : null;
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  const db = await getDb();
  const id = newId();
  const ts = now();
  await db.runAsync(
    `INSERT INTO categories (id, name, color, icon, is_default, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
    [
      id,
      input.name,
      input.color ?? null,
      input.icon ?? null,
      input.sortOrder ?? 0,
      ts,
      ts,
    ]
  );
  const created = await getCategoryById(id);
  if (!created) throw new Error('Category insert succeeded but row not found');
  emit('categories-changed');
  return created;
}

export async function updateCategory(id: string, patch: UpdateCategoryInput): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if (patch.name !== undefined)      { sets.push('name = ?');       args.push(patch.name); }
  if (patch.color !== undefined)     { sets.push('color = ?');      args.push(patch.color); }
  if (patch.icon !== undefined)      { sets.push('icon = ?');       args.push(patch.icon); }
  if (patch.sortOrder !== undefined) { sets.push('sort_order = ?'); args.push(patch.sortOrder); }

  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  args.push(now());
  args.push(id);

  await db.runAsync(
    `UPDATE categories SET ${sets.join(', ')} WHERE id = ?`,
    args
  );
  emit('categories-changed');
}

export async function softDeleteCategory(id: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.runAsync(
    `UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [ts, ts, id]
  );
  // Categories changing also affects tasks (filter pills, row meta).
  emit('categories-changed');
  emit('tasks-changed');
}

// Idempotent. Called from getDb() on every app launch — safe to re-run.
export async function seedDefaultCategoriesIfEmpty(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM categories WHERE deleted_at IS NULL`
  );
  if ((row?.n ?? 0) > 0) return;

  const ts = now();
  for (const d of DEFAULTS) {
    await db.runAsync(
      `INSERT OR IGNORE INTO categories (id, name, color, icon, is_default, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
      [d.id, d.name, d.color, d.icon, d.sortOrder, ts, ts]
    );
  }
}
