import type { Task } from '../db';
import { startOfDay } from './date';

export type TaskBucket = 'previous' | 'today' | 'upcoming' | 'no-date';

export type TaskSection = {
  key: TaskBucket;
  title: string;
  data: Task[];
};

const BUCKET_TITLE: Record<TaskBucket, string> = {
  previous: 'Previous',
  today: 'Today',
  upcoming: 'Upcoming',
  'no-date': 'No Date',
};

// Order matters: this is the visual order users see.
const ORDER: TaskBucket[] = ['previous', 'today', 'upcoming', 'no-date'];

function bucketOf(task: Task, todayStart: number): TaskBucket {
  if (task.dueAt === null) return 'no-date';
  const day = startOfDay(task.dueAt);
  if (day < todayStart) return 'previous';
  if (day === todayStart) return 'today';
  return 'upcoming';
}

/** Tie-break for in-section ordering: pinned first, then earliest date+time, then sort_order. */
function compareTasks(a: Task, b: Task): number {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;

  // Both have a date: earliest first.
  if (a.dueAt !== null && b.dueAt !== null) {
    if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
    const aTime = a.dueTime ?? 1440;
    const bTime = b.dueTime ?? 1440;
    if (aTime !== bTime) return aTime - bTime;
  } else if (a.dueAt !== null) {
    return -1;
  } else if (b.dueAt !== null) {
    return 1;
  }

  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.createdAt - b.createdAt;
}

/**
 * Bucket tasks into Previous / Today / Upcoming / No Date. Empty buckets are
 * dropped so SectionList doesn't render dead headers.
 */
export function groupTasksIntoSections(
  tasks: ReadonlyArray<Task>,
  nowTs: number = Date.now()
): TaskSection[] {
  const todayStart = startOfDay(nowTs);
  const buckets: Record<TaskBucket, Task[]> = {
    previous: [],
    today: [],
    upcoming: [],
    'no-date': [],
  };

  for (const t of tasks) buckets[bucketOf(t, todayStart)].push(t);

  return ORDER
    .filter((key) => buckets[key].length > 0)
    .map<TaskSection>((key) => ({
      key,
      title: BUCKET_TITLE[key],
      data: buckets[key].slice().sort(compareTasks),
    }));
}
