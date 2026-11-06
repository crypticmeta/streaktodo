import { addDays, dateKeyFromTimestamp, isCalendarDate, timestampFromDateKey } from '../../lib/date';
import { getDb } from '../client';

export type InsightsDayActivity = {
  ts: number;
  due: number;
  completed: number;
};

export type InsightsSnapshot = {
  totals: {
    total: number;
    done: number;
    pending: number;
    overdue: number;
  };
  activity: InsightsDayActivity[];
  upcomingCounts: Map<number, number>;
  categoryBreakdown: Array<{ categoryId: string | null; count: number }>;
};

function count(value: number | null | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
}

/**
 * Read the Insights dashboard as SQL aggregates. Even a 50k-task backup now
 * crosses the JS bridge as a few counters plus one row per active calendar
 * day/category, instead of 50k full task objects.
 */
export async function getInsightsSnapshot(todayStart: number): Promise<InsightsSnapshot> {
  const db = await getDb();
  const today = dateKeyFromTimestamp(todayStart);
  const upcomingEnd = dateKeyFromTimestamp(addDays(todayStart, 7));

  const [totalsRow, activityRows, upcomingRows, categoryRows] = await Promise.all([
    db.getFirstAsync<{
      total: number;
      done: number | null;
      pending: number | null;
      overdue: number | null;
    }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status = 'pending' AND due_date < ? THEN 1 ELSE 0 END) AS overdue
         FROM tasks
        WHERE deleted_at IS NULL`,
      [today]
    ),
    db.getAllAsync<{
      day: string | null;
      due_count: number;
      completed_count: number;
    }>(
      `SELECT day,
              SUM(due_count) AS due_count,
              SUM(completed_count) AS completed_count
         FROM (
           SELECT due_date AS day, COUNT(*) AS due_count, 0 AS completed_count
             FROM tasks
            WHERE deleted_at IS NULL AND due_date IS NOT NULL
            GROUP BY due_date
           UNION ALL
           SELECT strftime('%Y-%m-%d', completed_at / 1000.0, 'unixepoch', 'localtime') AS day,
                  0 AS due_count, COUNT(*) AS completed_count
             FROM tasks
            WHERE deleted_at IS NULL AND status = 'done' AND completed_at IS NOT NULL
            GROUP BY day
         )
        GROUP BY day
        ORDER BY day`
    ),
    db.getAllAsync<{ day: string; pending_count: number }>(
      `SELECT due_date AS day, COUNT(*) AS pending_count
         FROM tasks
        WHERE deleted_at IS NULL AND status = 'pending'
          AND due_date > ? AND due_date <= ?
        GROUP BY due_date
        ORDER BY due_date`,
      [today, upcomingEnd]
    ),
    db.getAllAsync<{ category_id: string | null; task_count: number }>(
      `SELECT category_id, COUNT(*) AS task_count
         FROM tasks
        WHERE deleted_at IS NULL
        GROUP BY category_id
        ORDER BY task_count DESC`
    ),
  ]);

  const activity = activityRows.flatMap((row) => {
    if (!row.day || !isCalendarDate(row.day)) return [];
    return [{
      ts: timestampFromDateKey(row.day),
      due: count(row.due_count),
      completed: count(row.completed_count),
    }];
  });
  const upcomingCounts = new Map<number, number>();
  for (const row of upcomingRows) {
    if (!isCalendarDate(row.day)) continue;
    upcomingCounts.set(timestampFromDateKey(row.day), count(row.pending_count));
  }

  return {
    totals: {
      total: count(totalsRow?.total),
      done: count(totalsRow?.done),
      pending: count(totalsRow?.pending),
      overdue: count(totalsRow?.overdue),
    },
    activity,
    upcomingCounts,
    categoryBreakdown: categoryRows.map((row) => ({
      categoryId: row.category_id,
      count: count(row.task_count),
    })),
  };
}
