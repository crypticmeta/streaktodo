import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { startOfDay } from './date';

/** Refresh calendar-derived UI at local midnight and whenever the app resumes. */
export function useTodayStart(): number {
  const [today, setToday] = useState(() => startOfDay());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      setToday(startOfDay());
      const next = new Date();
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 1, 0);
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, Math.max(1_000, next.getTime() - Date.now()));
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return today;
}
