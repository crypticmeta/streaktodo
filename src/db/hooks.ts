import { useCallback, useEffect, useRef, useState } from 'react';
import { categoriesRepo, tasksRepo, type Category, type Task } from './index';
import type { ListTasksFilter } from './repos/tasks';

type UseTasksState = {
  tasks: Task[];
  loading: boolean;
  error: string | null;
};

type UseTasksReturn = UseTasksState & {
  /** Re-read from the DB. Use after writes. */
  refresh: () => Promise<void>;
};

/**
 * Tiny query hook. Re-runs only when the filter's *content* changes — not on
 * every render — so callers can pass an inline `{ status: 'all' }` object
 * without causing a fetch loop.
 *
 * We deliberately do NOT subscribe to DB change notifications yet; explicit
 * refresh keeps the data flow obvious while we're still small.
 */
export function useTasks(filter?: ListTasksFilter): UseTasksReturn {
  const [state, setState] = useState<UseTasksState>({
    tasks: [],
    loading: true,
    error: null,
  });

  // The filter object is allowed to be a fresh literal on every render. We
  // depend on a serialized key so the effect only re-fires when the contents
  // actually change. The latest filter value is read via a ref so refresh()
  // always sees the current filter without becoming a new function reference.
  const key = serializeFilter(filter);
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const refresh = useCallback(async () => {
    try {
      const tasks = await tasksRepo.listTasks(filterRef.current);
      setState({ tasks, loading: false, error: null });
    } catch (err) {
      setState({
        tasks: [],
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load tasks.',
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [key, refresh]);

  return { ...state, refresh };
}

// Stable string key from filter contents. JSON.stringify is fine here — the
// filter object only contains primitives (status, ids, timestamps, booleans).
// Key order is deterministic via explicit field listing so two semantically
// equal filters always produce the same key, regardless of property order.
function serializeFilter(f: ListTasksFilter | undefined): string {
  if (!f) return '∅';
  return [
    f.status ?? 'pending',
    f.categoryId === undefined ? '_' : f.categoryId === null ? 'null' : f.categoryId,
    f.dueAtMin ?? '_',
    f.dueAtMax ?? '_',
    f.pinnedFirst === false ? 'no-pin' : 'pin',
  ].join('|');
}

type UseCategoriesState = {
  categories: Category[];
  loading: boolean;
  error: string | null;
};

type UseCategoriesReturn = UseCategoriesState & {
  refresh: () => Promise<void>;
};

/**
 * List of all (non-deleted) categories. The default three (Work / Personal /
 * Wishlist) are seeded on first DB open, so the list is never empty in
 * practice.
 */
export function useCategories(): UseCategoriesReturn {
  const [state, setState] = useState<UseCategoriesState>({
    categories: [],
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      const categories = await categoriesRepo.listCategories();
      setState({ categories, loading: false, error: null });
    } catch (err) {
      setState({
        categories: [],
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load categories.',
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
