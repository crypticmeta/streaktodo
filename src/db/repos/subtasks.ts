import { getDb } from '../client';
import { emit } from '../events';
import { newId } from '../ids';
import { now } from '../time';
import { subtaskFromRow, type Subtask, type SubtaskStatus } from '../schema';

export type CreateSubtaskInput = {
  taskId: string;
  title: string;
  sortOrder?: number;
};

export type UpdateSubtaskInput = {
  title?: string;
  status?: SubtaskStatus;
  sortOrder?: number;
};

export async function listSubtasksByTask(taskId: string): Promise<Subtask[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<unknown>(
    `SELECT * FROM subtasks
       WHERE task_id = ? AND deleted_at IS NULL
       ORDER BY sort_order ASC, created_at ASC`,
    [taskId]
  );
  return rows.map(subtaskFromRow);
}

export async function listSubtasksByTaskIds(
  taskIds: string[]
): Promise<Record<string, Subtask[]>> {
  if (taskIds.length === 0) return {};
  const db = await getDb();
  const placeholders = taskIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<unknown>(
    `SELECT * FROM subtasks
       WHERE deleted_at IS NULL AND task_id IN (${placeholders})
       ORDER BY task_id ASC, sort_order ASC, created_at ASC`,
    taskIds
  );
  const out: Record<string, Subtask[]> = {};
  for (const raw of rows) {
    const subtask = subtaskFromRow(raw);
    (out[subtask.taskId] ??= []).push(subtask);
  }
  return out;
}

export async function getSubtaskById(id: string): Promise<Subtask | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<unknown>(
    `SELECT * FROM subtasks WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return row ? subtaskFromRow(row) : null;
}

export async function createSubtask(input: CreateSubtaskInput): Promise<Subtask> {
  const db = await getDb();
  const id = newId();
  const ts = now();
  await db.runAsync(
    `INSERT INTO subtasks (id, task_id, title, status, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
    [id, input.taskId, input.title, input.sortOrder ?? 0, ts, ts]
  );
  const created = await getSubtaskById(id);
  if (!created) throw new Error('Subtask insert succeeded but row not found');
  emit('tasks-changed');
  return created;
}

export async function updateSubtask(id: string, patch: UpdateSubtaskInput): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if (patch.title !== undefined)     { sets.push('title = ?');      args.push(patch.title); }
  if (patch.status !== undefined)    { sets.push('status = ?');     args.push(patch.status); }
  if (patch.sortOrder !== undefined) { sets.push('sort_order = ?'); args.push(patch.sortOrder); }

  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  args.push(now());
  args.push(id);

  await db.runAsync(`UPDATE subtasks SET ${sets.join(', ')} WHERE id = ?`, args);
  emit('tasks-changed');
}

export async function softDeleteSubtask(id: string): Promise<void> {
  const db = await getDb();
  const ts = now();
  await db.runAsync(
    `UPDATE subtasks SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [ts, ts, id]
  );
  emit('tasks-changed');
}

// Returns a map of taskId → { total, done } for active subtasks. One query
// regardless of input size, so the UI can render counts without N+1 reads.
export async function countsByTaskIds(
  taskIds: string[]
): Promise<Record<string, { total: number; done: number }>> {
  if (taskIds.length === 0) return {};
  const db = await getDb();
  const placeholders = taskIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<{
    task_id: string;
    total: number;
    done: number;
  }>(
    `SELECT task_id,
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done
       FROM subtasks
      WHERE deleted_at IS NULL AND task_id IN (${placeholders})
      GROUP BY task_id`,
    taskIds
  );
  const out: Record<string, { total: number; done: number }> = {};
  for (const r of rows) {
    out[r.task_id] = { total: r.total, done: r.done };
  }
  return out;
}
