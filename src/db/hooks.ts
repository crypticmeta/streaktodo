import { useCallback, useEffect, useRef, useState } from 'react';
import { type DbEvent, subscribe } from './events';
import * as categoriesRepo from './repos/categories';
import * as insightsRepo from './repos/insights';
import * as tasksRepo from './repos/tasks';
import type { ListTasksFilter } from './repos/tasks';
import type { Category, Task } from './schema';
import {
  computeStreakStatsFromActivity,
  computeUpcomingWeekFromCounts,
  computeWeeklyCompletionFromActivity,
  type CategorySlice,
  type OverviewTotals,
  type StreakStats,
  type UpcomingDay,
  type WeeklyBar,
} from '../lib/streakStats';

type UseTasksState = {
  tasks: Task[];
  loading: boolean;
  error: string | null;
};

type UseTasksReturn = UseTasksState & {
  /** Re-read from the DB. Use after writes. */
  refresh: () => Promise<void>;
};

type UsePaginatedTasksState = UseTasksState & {
  loadingMore: boolean;
  hasMore: boolean;
  totalCount: number;
};

type UsePaginatedTasksReturn = UsePaginatedTasksState & {
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
};

/**
 * Tiny query hook. Re-runs only when the filter's *content* changes — not on
 * every render — so callers can pass an inline `{ status: 'all' }` object
 * without causing a fetch loop.
 *
 * Also subscribes to the `tasks-changed` event so any mutation in any screen
 * causes every mounted `useTasks` instance to re-fetch — fixes the stale-list
 * bug where deleting on the Calendar tab left the Tasks tab stale.
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
  const requestRef = useRef(0);
  const queuedRef = useRef(false);

  const runRefresh = useCallback(async (showLoading: boolean) => {
    const request = ++requestRef.current;
    if (showLoading) {
      setState((previous) => ({ ...previous, loading: true, error: null }));
    }
    try {
      const tasks = await tasksRepo.listTasks(filterRef.current);
      if (request !== requestRef.current) return;
      setState((previous) => ({
        tasks: reuseTaskObjects(previous.tasks, tasks),
        loading: false,
        error: null,
      }));
    } catch (err) {
      if (request !== requestRef.current) return;
      setState({
        tasks: [],
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load tasks.',
      });
    }
  }, []);

  const refresh = useCallback(() => runRefresh(true), [runRefresh]);

  useEffect(() => {
    void runRefresh(true);
  }, [key, runRefresh]);

  // Live updates: whenever any screen mutates a task, every useTasks instance
  // re-runs its query.
  useEffect(() => {
    const unsubscribe = subscribe('tasks-changed', () => {
      if (queuedRef.current) return;
      queuedRef.current = true;
      queueMicrotask(() => {
        queuedRef.current = false;
        void runRefresh(false);
      });
    });
    return unsubscribe;
  }, [runRefresh]);

  return { ...state, refresh };
}

/**
 * Task query for long, virtualized lists. It materializes one bounded page at
 * a time while keeping an exact SQL count for honest filtered-result copy.
 * Any mutation invalidates the cursor and refreshes page one, which avoids
 * offset drift when rows are inserted, completed, or reordered.
 */
export function usePaginatedTasks(
  filter?: ListTasksFilter,
  pageSize = 100
): UsePaginatedTasksReturn {
  const boundedPageSize = Math.max(20, Math.min(500, Math.floor(pageSize)));
  const [state, setState] = useState<UsePaginatedTasksState>({
    tasks: [],
    loading: true,
    loadingMore: false,
    hasMore: false,
    totalCount: 0,
    error: null,
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const requestRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const queuedRef = useRef(false);
  const key = serializeFilter(filter);

  const runFirstPage = useCallback(async (showLoading: boolean, clearRows: boolean) => {
    const request = ++requestRef.current;
    loadingMoreRef.current = false;
    if (showLoading || clearRows) {
      setState((previous) => ({
        ...previous,
        tasks: clearRows ? [] : previous.tasks,
        loading: showLoading,
        loadingMore: false,
        hasMore: clearRows ? false : previous.hasMore,
        totalCount: clearRows ? 0 : previous.totalCount,
        error: null,
      }));
    }
    try {
      const currentFilter = filterRef.current;
      const [rows, totalCount] = await Promise.all([
        tasksRepo.listTasks({
          ...currentFilter,
          limit: boundedPageSize + 1,
          offset: 0,
        }),
        tasksRepo.countTasks(currentFilter),
      ]);
      if (request !== requestRef.current) return;
      const tasks = rows.slice(0, boundedPageSize);
      setState((previous) => ({
        tasks: reuseTaskObjects(previous.tasks, tasks),
        loading: false,
        loadingMore: false,
        hasMore: rows.length > boundedPageSize,
        totalCount,
        error: null,
      }));
    } catch (err) {
      if (request !== requestRef.current) return;
      setState((previous) => ({
        ...previous,
        tasks: clearRows ? [] : previous.tasks,
        loading: false,
        loadingMore: false,
        hasMore: clearRows ? false : previous.hasMore,
        totalCount: clearRows ? 0 : previous.totalCount,
        error: err instanceof Error ? err.message : 'Failed to load tasks.',
      }));
    }
  }, [boundedPageSize]);

  const refresh = useCallback(
    () => runFirstPage(true, false),
    [runFirstPage]
  );

  const loadMore = useCallback(async () => {
    const current = stateRef.current;
    if (loadingMoreRef.current || current.loading || !current.hasMore) return;
    loadingMoreRef.current = true;
    const request = requestRef.current;
    setState((previous) => ({ ...previous, loadingMore: true, error: null }));
    try {
      const rows = await tasksRepo.listTasks({
        ...filterRef.current,
        limit: boundedPageSize + 1,
        offset: current.tasks.length,
      });
      if (request !== requestRef.current) return;
      const page = rows.slice(0, boundedPageSize);
      setState((previous) => {
        const seen = new Set(previous.tasks.map((task) => task.id));
        const appended = page.filter((task) => !seen.has(task.id));
        return {
          ...previous,
          tasks: [...previous.tasks, ...appended],
          loadingMore: false,
          hasMore: rows.length > boundedPageSize &&
            previous.tasks.length + appended.length < previous.totalCount,
          error: null,
        };
      });
    } catch (err) {
      if (request !== requestRef.current) return;
      setState((previous) => ({
        ...previous,
        loadingMore: false,
        error: err instanceof Error ? err.message : 'Failed to load more tasks.',
      }));
    } finally {
      loadingMoreRef.current = false;
    }
  }, [boundedPageSize]);

  useEffect(() => {
    void runFirstPage(true, true);
  }, [key, runFirstPage]);

  useEffect(() => {
    const unsubscribe = subscribe('tasks-changed', () => {
      if (queuedRef.current) return;
      queuedRef.current = true;
      queueMicrotask(() => {
        queuedRef.current = false;
        void runFirstPage(false, false);
      });
    });
    return unsubscribe;
  }, [runFirstPage]);

  return { ...state, refresh, loadMore };
}

type UseTaskCountReturn = {
  count: number;
  loading: boolean;
  error: string | null;
};

/** Exact lightweight count for headers that must not depend on loaded pages. */
export function useTaskCount(filter?: ListTasksFilter): UseTaskCountReturn {
  const [state, setState] = useState<UseTaskCountReturn>({
    count: 0,
    loading: true,
    error: null,
  });
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const requestRef = useRef(0);
  const queuedRef = useRef(false);
  const key = serializeFilter(filter);

  const refresh = useCallback(async () => {
    const request = ++requestRef.current;
    try {
      const count = await tasksRepo.countTasks(filterRef.current);
      if (request !== requestRef.current) return;
      setState({ count, loading: false, error: null });
    } catch (err) {
      if (request !== requestRef.current) return;
      setState((previous) => ({
        ...previous,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to count tasks.',
      }));
    }
  }, []);

  useEffect(() => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    void refresh();
  }, [key, refresh]);

  useEffect(() => subscribe('tasks-changed', () => {
    if (queuedRef.current) return;
    queuedRef.current = true;
    queueMicrotask(() => {
      queuedRef.current = false;
      void refresh();
    });
  }), [refresh]);

  return state;
}

type InsightsData = {
  totals: OverviewTotals;
  streak: StreakStats;
  weekly: WeeklyBar[];
  upcoming: UpcomingDay[];
  breakdown: CategorySlice[];
};

type UseInsightsReturn = InsightsData & {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

function emptyInsights(todayStart: number): InsightsData {
  return {
    totals: { total: 0, done: 0, pending: 0, overdue: 0 },
    streak: computeStreakStatsFromActivity([], todayStart),
    weekly: computeWeeklyCompletionFromActivity([], todayStart),
    upcoming: computeUpcomingWeekFromCounts(new Map(), todayStart),
    breakdown: [],
  };
}

/** SQL-aggregated dashboard state; does not materialize the task table. */
export function useInsights(todayStart: number): UseInsightsReturn {
  const [state, setState] = useState<InsightsData & {
    loading: boolean;
    error: string | null;
  }>(() => ({ ...emptyInsights(todayStart), loading: true, error: null }));
  const requestRef = useRef(0);
  const queuedRef = useRef(false);

  const runRefresh = useCallback(async (showLoading: boolean) => {
    const request = ++requestRef.current;
    if (showLoading) {
      setState((previous) => ({ ...previous, loading: true, error: null }));
    }
    try {
      const snapshot = await insightsRepo.getInsightsSnapshot(todayStart);
      if (request !== requestRef.current) return;
      setState({
        totals: snapshot.totals,
        streak: computeStreakStatsFromActivity(snapshot.activity, todayStart),
        weekly: computeWeeklyCompletionFromActivity(snapshot.activity, todayStart),
        upcoming: computeUpcomingWeekFromCounts(snapshot.upcomingCounts, todayStart),
        breakdown: snapshot.categoryBreakdown,
        loading: false,
        error: null,
      });
    } catch (err) {
      if (request !== requestRef.current) return;
      setState((previous) => ({
        ...previous,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load insights.',
      }));
    }
  }, [todayStart]);

  const refresh = useCallback(() => runRefresh(true), [runRefresh]);

  useEffect(() => {
    void runRefresh(true);
  }, [runRefresh]);

  useEffect(() => subscribe('tasks-changed', () => {
    if (queuedRef.current) return;
    queuedRef.current = true;
    queueMicrotask(() => {
      queuedRef.current = false;
      void runRefresh(false);
    });
  }), [runRefresh]);

  return { ...state, refresh };
}

function sameTask(a: Task, b: Task): boolean {
  return (
    a.id === b.id && a.title === b.title && a.notes === b.notes &&
    a.categoryId === b.categoryId && a.dueAt === b.dueAt &&
    a.dueDate === b.dueDate && a.dueTime === b.dueTime &&
    a.status === b.status && a.isPinned === b.isPinned &&
    a.completedAt === b.completedAt && a.sortOrder === b.sortOrder &&
    a.createdAt === b.createdAt && a.updatedAt === b.updatedAt &&
    a.deletedAt === b.deletedAt && a.seriesId === b.seriesId &&
    a.parentOccurrenceId === b.parentOccurrenceId
  );
}

function reuseTaskObjects(previous: Task[], next: Task[]): Task[] {
  if (previous.length === 0 || next.length === 0) return next;
  const byId = new Map(previous.map((task) => [task.id, task]));
  let changed = previous.length !== next.length;
  const reused = next.map((task, index) => {
    const old = byId.get(task.id);
    const value = old && sameTask(old, task) ? old : task;
    if (value !== previous[index]) changed = true;
    return value;
  });
  return changed ? reused : previous;
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
    f.dueDate ?? '_',
    f.pinnedFirst === false ? 'no-pin' : 'pin',
    f.query?.trim() ?? '',
    f.deleted ?? 'active',
    f.limit ?? '_',
    f.offset ?? '_',
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
 * practice. Subscribes to `categories-changed`.
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

  useEffect(() => {
    const unsubscribe = subscribe('categories-changed', () => {
      void refresh();
    });
    return unsubscribe;
  }, [refresh]);

  return { ...state, refresh };
}

/**
 * Returns a counter that bumps every time `event` fires. Components can put
 * the counter in a useEffect dep array to re-run derived queries (subtask
 * counts, calendar markers, reminder/repeat presence sets) when the
 * underlying data changes.
 */
export function useDbVersion(event: DbEvent): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribe(event, () => {
      setV((n) => n + 1);
    });
    return unsubscribe;
  }, [event]);
  return v;
}
