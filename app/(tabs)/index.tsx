import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fab } from '../../src/components/Fab';
import { TaskComposer } from '../../src/components/TaskComposer';
import type { ScheduleDraft } from '../../src/components/scheduleTypes';
import { subtasksRepo, tasksRepo, useCategories, useTasks } from '../../src/db';
import type { CreateTaskFullInput } from '../../src/db/repos/tasks';
import { formatRelativeShort, isOverdue } from '../../src/lib/date';
import { useTheme } from '../../src/theme';

// Pure mapper: schedule draft → repo input. Lives here because it's the bridge
// between composer-shaped state and DB-shaped state, both of which already
// belong to the home screen's submit flow.
const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

function repeatRuleFromSchedule(s: ScheduleDraft): CreateTaskFullInput['repeatRule'] {
  if (s.repeat.preset === 'none' || s.dueAt === null) return null;
  const d = new Date(s.dueAt);
  switch (s.repeat.preset) {
    case 'daily':
      return { freq: 'daily', intervalN: 1 };
    case 'weekly':
      return { freq: 'weekly', intervalN: 1, byWeekday: WEEKDAY_CODES[d.getDay()] };
    case 'monthly':
      return { freq: 'monthly', intervalN: 1, byMonthDay: d.getDate() };
    case 'yearly':
      return { freq: 'yearly', intervalN: 1, byMonth: d.getMonth() + 1, byMonthDay: d.getDate() };
    case 'custom':
      return s.repeat.custom
        ? {
            freq: s.repeat.custom.freq,
            intervalN: s.repeat.custom.intervalN,
            byWeekday: s.repeat.custom.byWeekday ?? null,
            byMonthDay: s.repeat.custom.byMonthDay ?? null,
            byMonth: s.repeat.custom.byMonth ?? null,
          }
        : { freq: 'weekly', intervalN: 1 };
  }
}

function remindersFromSchedule(s: ScheduleDraft): CreateTaskFullInput['reminders'] {
  if (!s.reminder.enabled || s.dueAt === null) return undefined;
  return [{ leadMinutes: s.reminder.leadMinutes, type: s.reminder.type }];
}

// Phase 2 surface: persistence + composer subtasks work, but the polished
// row UI (checkbox in row, pin star, metadata line, day grouping) is the
// next checkbox. Until then we render a minimal proof-of-life list so we
// can see the data flow.
export default function TasksScreen() {
  const t = useTheme();
  const [composerOpen, setComposerOpen] = useState(false);
  const { tasks, loading, error, refresh } = useTasks({ status: 'all' });
  const { categories } = useCategories();
  const [subtaskCounts, setSubtaskCounts] = useState<
    Record<string, { total: number; done: number }>
  >({});

  // Lookup map so each card can resolve its category in O(1).
  const categoriesById = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null }>();
    for (const c of categories) m.set(c.id, { name: c.name, color: c.color });
    return m;
  }, [categories]);

  // Reload subtask counts whenever the task list changes.
  const taskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const counts = await subtasksRepo.countsByTaskIds(taskIds);
      if (!cancelled) setSubtaskCounts(counts);
    })();
    return () => {
      cancelled = true;
    };
  }, [taskIds]);

  const handleSubmit = useCallback(
    async ({
      title,
      subtasks,
      categoryId,
      schedule,
    }: {
      title: string;
      subtasks: string[];
      categoryId: string | null;
      schedule: ScheduleDraft;
    }) => {
      await tasksRepo.createTaskFull({
        task: {
          title,
          categoryId,
          dueAt: schedule.dueAt,
          dueTime: schedule.dueTime,
        },
        subtaskTitles: subtasks,
        reminders: remindersFromSchedule(schedule),
        repeatRule: repeatRuleFromSchedule(schedule),
      });
      await refresh();
    },
    [refresh]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.color.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: t.spacing['6xl'] }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.eyebrow, { color: t.color.textMuted, letterSpacing: t.tracking.wider }]}>
          Today
        </Text>
        <Text style={[styles.title, { color: t.color.textPrimary, fontSize: t.fontSize['3xl'] }]}>
          Tasks
        </Text>

        {loading ? (
          <Text style={[styles.subtitle, { color: t.color.textSecondary, fontSize: t.fontSize.base }]}>
            Loading…
          </Text>
        ) : error ? (
          <Text style={[styles.subtitle, { color: t.color.danger, fontSize: t.fontSize.base }]}>
            {error}
          </Text>
        ) : tasks.length === 0 ? (
          <>
            <Text style={[styles.subtitle, { color: t.color.textSecondary, fontSize: t.fontSize.base }]}>
              Tap the + button to add your first task.
            </Text>
            <View
              style={[
                styles.placeholderCard,
                {
                  backgroundColor: t.color.surface,
                  borderColor: t.color.border,
                  borderRadius: t.radius['2xl'],
                  padding: t.spacing['2xl'],
                  marginTop: t.spacing['3xl'],
                  ...t.elevation.lg,
                },
              ]}
            >
              <Text style={[styles.placeholderHeading, { color: t.color.textPrimary }]}>
                No tasks yet
              </Text>
              <Text style={[styles.placeholderBody, { color: t.color.textSecondary }]}>
                The list will appear here once you create one.
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.subtitle, { color: t.color.textSecondary, fontSize: t.fontSize.base }]}>
              {tasks.length} task{tasks.length === 1 ? '' : 's'}
            </Text>

            <View style={{ marginTop: t.spacing['2xl'], gap: t.spacing.sm }}>
              {tasks.map((task) => {
                const counts = subtaskCounts[task.id];
                const cat = task.categoryId ? categoriesById.get(task.categoryId) : null;
                const overdue =
                  task.dueAt !== null && task.status !== 'done' && isOverdue(task.dueAt);

                const metaParts: string[] = [];
                if (counts && counts.total > 0) {
                  metaParts.push(
                    `${counts.done}/${counts.total} subtask${counts.total === 1 ? '' : 's'}`
                  );
                }
                if (cat) metaParts.push(cat.name);
                // Date is rendered as its own colored span; we omit it from metaParts.

                return (
                  <View
                    key={task.id}
                    style={{
                      backgroundColor: t.color.surface,
                      borderColor: t.color.border,
                      borderWidth: 1,
                      borderRadius: t.radius.lg,
                      paddingHorizontal: t.spacing.lg,
                      paddingVertical: t.spacing.md,
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: t.spacing.md,
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        marginTop: 6,
                        backgroundColor: cat?.color ?? 'transparent',
                        borderWidth: cat ? 0 : 1,
                        borderColor: t.color.borderStrong,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: t.color.textPrimary,
                          fontSize: t.fontSize.md,
                          fontWeight: t.fontWeight.medium,
                          textDecorationLine: task.status === 'done' ? 'line-through' : 'none',
                          opacity: task.status === 'done' ? 0.55 : 1,
                        }}
                      >
                        {task.title}
                      </Text>

                      {task.dueAt !== null || metaParts.length > 0 ? (
                        <Text
                          style={{
                            color: t.color.textMuted,
                            fontSize: t.fontSize.xs,
                            marginTop: 4,
                          }}
                        >
                          {task.dueAt !== null ? (
                            <Text
                              style={{
                                color: overdue ? t.color.danger : t.color.textMuted,
                                fontWeight: overdue ? t.fontWeight.semibold : t.fontWeight.regular,
                              }}
                            >
                              {formatRelativeShort(task.dueAt)}
                            </Text>
                          ) : null}
                          {task.dueAt !== null && metaParts.length > 0 ? ' · ' : ''}
                          {metaParts.join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <Fab
        onPress={() => setComposerOpen(true)}
        accessibilityLabel="Add task"
        hint="Opens the task composer"
      />

      <TaskComposer
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSubmit={handleSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  eyebrow: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  title: {
    fontWeight: '700',
    marginTop: 4,
  },
  subtitle: {
    marginTop: 4,
    lineHeight: 21,
  },
  placeholderCard: {
    borderWidth: 1,
  },
  placeholderHeading: {
    fontSize: 18,
    fontWeight: '700',
  },
  placeholderBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
  },
});
