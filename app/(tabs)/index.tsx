import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryPills } from '../../src/components/CategoryPills';
import { Fab } from '../../src/components/Fab';
import { TaskComposer } from '../../src/components/TaskComposer';
import { TaskRow } from '../../src/components/TaskRow';
import type { ScheduleDraft } from '../../src/components/scheduleTypes';
import {
  remindersRepo,
  repeatRulesRepo,
  subtasksRepo,
  tasksRepo,
  useCategories,
  useTasks,
  type Task,
} from '../../src/db';
import type { CreateTaskFullInput } from '../../src/db/repos/tasks';
import { groupTasksIntoSections } from '../../src/lib/taskGrouping';
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

// Local optimistic patch applied on top of a Task while a write is in flight.
type Patch = Partial<Pick<Task, 'status' | 'isPinned' | 'completedAt'>>;

export default function TasksScreen() {
  const t = useTheme();
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  // useTasks filter: categoryId undefined = "All" (no filter); a string id =
  // tasks in that category. We never pass null here (which would mean "no
  // category" — a niche case we'll expose later if needed).
  const { tasks, loading, error, refresh } = useTasks(
    selectedCategoryId !== null
      ? { status: 'all', categoryId: selectedCategoryId }
      : { status: 'all' }
  );
  const { categories } = useCategories();
  const [subtaskCounts, setSubtaskCounts] = useState<
    Record<string, { total: number; done: number }>
  >({});
  const [reminderIds, setReminderIds] = useState<Set<string>>(() => new Set());
  const [repeatIds, setRepeatIds] = useState<Set<string>>(() => new Set());
  const [optimistic, setOptimistic] = useState<Record<string, Patch>>({});

  // Lookup map so each row can resolve its category in O(1).
  const categoriesById = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null }>();
    for (const c of categories) m.set(c.id, { name: c.name, color: c.color });
    return m;
  }, [categories]);

  // Reload subtask counts + reminder/repeat presence whenever the task list
  // changes. One query per relation, no N+1.
  const taskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [counts, reminders, repeats] = await Promise.all([
        subtasksRepo.countsByTaskIds(taskIds),
        remindersRepo.taskIdsWithReminders(taskIds),
        repeatRulesRepo.taskIdsWithRepeat(taskIds),
      ]);
      if (cancelled) return;
      setSubtaskCounts(counts);
      setReminderIds(reminders);
      setRepeatIds(repeats);
    })();
    return () => {
      cancelled = true;
    };
  }, [taskIds]);

  // Effective task list: pinned-first sort already happens in the repo; we
  // overlay optimistic patches on top so completion / pin taps feel instant.
  const visibleTasks = useMemo(() => {
    if (Object.keys(optimistic).length === 0) return tasks;
    return tasks.map((task) => {
      const p = optimistic[task.id];
      return p ? { ...task, ...p } : task;
    });
  }, [tasks, optimistic]);

  // Bucket into Previous / Today / Upcoming / No Date for SectionList.
  const sections = useMemo(() => groupTasksIntoSections(visibleTasks), [visibleTasks]);

  const setPatch = useCallback((id: string, patch: Patch | null) => {
    setOptimistic((prev) => {
      if (patch === null) {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: { ...prev[id], ...patch } };
    });
  }, []);

  const handleToggleComplete = useCallback(
    (id: string, nextStatus: 'done' | 'pending') => {
      // Optimistic.
      setPatch(id, {
        status: nextStatus,
        completedAt: nextStatus === 'done' ? Date.now() : null,
      });
      (async () => {
        try {
          if (nextStatus === 'done') await tasksRepo.completeTask(id);
          else await tasksRepo.uncompleteTask(id);
          await refresh();
          setPatch(id, null);
        } catch {
          setPatch(id, null);
        }
      })();
    },
    [refresh, setPatch]
  );

  const handleTogglePin = useCallback(
    (id: string, nextPinned: boolean) => {
      setPatch(id, { isPinned: nextPinned });
      (async () => {
        try {
          await tasksRepo.setPinned(id, nextPinned);
          await refresh();
          setPatch(id, null);
        } catch {
          setPatch(id, null);
        }
      })();
    },
    [refresh, setPatch]
  );

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

  // FlatList renderers. Theme-driven separators between rows so we don't need
  // gaps in the row component itself.
  const renderItem = useCallback(
    ({ item }: { item: Task }) => {
      const cat = item.categoryId ? categoriesById.get(item.categoryId) ?? null : null;
      return (
        <TaskRow
          task={item}
          category={cat}
          subtaskCounts={subtaskCounts[item.id]}
          hasReminder={reminderIds.has(item.id)}
          hasRepeat={repeatIds.has(item.id)}
          onToggleComplete={handleToggleComplete}
          onTogglePin={handleTogglePin}
        />
      );
    },
    [categoriesById, subtaskCounts, reminderIds, repeatIds, handleToggleComplete, handleTogglePin]
  );

  const keyExtractor = useCallback((task: Task) => task.id, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.color.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.lg }]}>
        <Text
          style={{
            color: t.color.textMuted,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: t.tracking.wider,
            fontWeight: t.fontWeight.semibold,
          }}
        >
          Today
        </Text>
        <Text
          style={{
            color: t.color.textPrimary,
            fontSize: t.fontSize['3xl'],
            fontWeight: t.fontWeight.bold,
            marginTop: 4,
          }}
        >
          Tasks
        </Text>
      </View>

      <CategoryPills
        categories={categories}
        selectedId={selectedCategoryId}
        onSelect={setSelectedCategoryId}
      />

      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View
            style={[
              styles.sectionHeader,
              { paddingTop: t.spacing.lg, paddingBottom: t.spacing.sm },
            ]}
          >
            <Text
              style={{
                color: t.color.textMuted,
                fontSize: 11,
                fontWeight: t.fontWeight.semibold,
                textTransform: 'uppercase',
                letterSpacing: t.tracking.wider,
              }}
            >
              {section.title}
            </Text>
            <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.xs, marginLeft: 6 }}>
              · {section.data.length}
            </Text>
          </View>
        )}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: t.spacing.xl,
            paddingTop: t.spacing.sm,
            paddingBottom: t.spacing['6xl'],
          },
          sections.length === 0 && styles.listContentEmpty,
        ]}
        ItemSeparatorComponent={() => <View style={{ height: t.spacing.sm }} />}
        SectionSeparatorComponent={null}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          loading ? (
            <Loading />
          ) : error ? (
            <ErrorState message={error} onRetry={refresh} />
          ) : (
            <EmptyState filtered={selectedCategoryId !== null} />
          )
        }
        keyboardShouldPersistTaps="handled"
      />

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

function Loading() {
  const t = useTheme();
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={t.color.accent} />
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  const t = useTheme();
  return (
    <View style={styles.centered}>
      <Text
        style={{
          color: t.color.danger,
          fontSize: t.fontSize.md,
          fontWeight: t.fontWeight.semibold,
          textAlign: 'center',
        }}
      >
        Couldn't load your tasks.
      </Text>
      <Text
        style={{
          color: t.color.textSecondary,
          fontSize: t.fontSize.sm,
          marginTop: 4,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
      <Pressable
        onPress={() => void onRetry()}
        hitSlop={8}
        style={({ pressed }) => [
          styles.retryButton,
          {
            borderColor: t.color.accent,
            borderRadius: t.radius.pill,
            backgroundColor: pressed ? t.color.accentSoft : 'transparent',
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Retry"
      >
        <Text style={{ color: t.color.accent, fontWeight: t.fontWeight.bold, fontSize: t.fontSize.sm }}>
          Try again
        </Text>
      </Pressable>
    </View>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  const t = useTheme();
  return (
    <View style={styles.centered}>
      <View
        style={[
          styles.emptyCard,
          {
            backgroundColor: t.color.surface,
            borderColor: t.color.border,
            borderRadius: t.radius['2xl'],
            padding: t.spacing['2xl'],
          },
        ]}
      >
        <Text style={{ fontSize: 28, marginBottom: 8 }}>✨</Text>
        <Text
          style={{
            color: t.color.textPrimary,
            fontSize: t.fontSize.lg,
            fontWeight: t.fontWeight.bold,
          }}
        >
          {filtered ? 'No tasks here' : 'Nothing on your plate'}
        </Text>
        <Text
          style={{
            color: t.color.textSecondary,
            fontSize: t.fontSize.sm,
            lineHeight: 20,
            marginTop: 6,
            textAlign: 'center',
          }}
        >
          {filtered
            ? 'Try a different filter, or add a task in this category.'
            : 'Tap the + button to add your first task.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {},
  listContent: {},
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyCard: {
    borderWidth: 1,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
});
