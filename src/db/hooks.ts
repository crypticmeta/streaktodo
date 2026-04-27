import { useCallback, useEffect, useState } from 'react';
import { tasksRepo, type Task } from './index';
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

// Tiny query hook. Re-runs when the filter object identity changes — callers
// should memoize the filter if they construct it inline. We deliberately do
// NOT subscribe to DB change notifications yet; explicit refresh keeps the
// data flow obvious while we're still small.
export function useTasks(filter?: ListTasksFilter): UseTasksReturn {
  const [state, setState] = useState<UseTasksState>({
    tasks: [],
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      const tasks = await tasksRepo.listTasks(filter);
      setState({ tasks, loading: false, error: null });
    } catch (err) {
      setState({
        tasks: [],
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load tasks.',
      });
    }
  }, [filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
