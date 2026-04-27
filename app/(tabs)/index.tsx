import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryPills } from '../../src/components/CategoryPills';
import { Fab } from '../../src/components/Fab';
import { TaskComposer } from '../../src/components/TaskComposer';
import { TaskRow } from '../../src/components/TaskRow';
import {
  remindersRepo,
  repeatRulesRepo,
  subtasksRepo,
  tasksRepo,
  useCategories,
  useDbVersion,
  useTasks,
  type Task,
} from '../../src/db';
import * as scheduler from '../../src/lib/notificationScheduler';
import { groupTasksIntoSections } from '../../src/lib/taskGrouping';
import { useTaskEditor } from '../../src/lib/useTaskEditor';
import { useTheme } from '../../src/theme';

// Local optimistic patch applied on top of a Task while a write is in flight.
type Patch = Partial<Pick<Task, 'status' | 'isPinned' | 'completedAt'>>;

export default function TasksScreen() {
  const t = useTheme();
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
  // changes OR any mutation hits the DB. One query per relation, no N+1.
  const taskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const dbVersion = useDbVersion('tasks-changed');
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
  }, [taskIds, dbVersion]);

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
          if (nextStatus === 'done') {
            await tasksRepo.completeTask(id);
            // Completed tasks shouldn't keep buzzing the phone.
            void scheduler.cancelForTask(id);
            // If the task carried a repeat rule, spawn its next occurrence and
            // arm reminders for it. Errors are swallowed — the user already
            // sees the original completion succeeding.
            try {
              const spawned = await tasksRepo.spawnNextOccurrence(id);
              if (spawned && spawned.dueAt !== null) {
                void scheduler.scheduleForTask({
                  taskId: spawned.id,
                  taskTitle: spawned.title,
                  taskDueAt: spawned.dueAt,
                  taskDueTime: spawned.dueTime,
                });
              }
            } catch {
              // best-effort
            }
          } else {
            await tasksRepo.uncompleteTask(id);
            // Re-arm in case the user un-checks an old completion.
            const t = await tasksRepo.getTaskById(id);
            if (t && t.dueAt !== null) {
              void scheduler.scheduleForTask({
                taskId: t.id,
                taskTitle: t.title,
                taskDueAt: t.dueAt,
                taskDueTime: t.dueTime,
              });
            }
          }
          // Refresh happens automatically via the tasks-changed event.
          setPatch(id, null);
        } catch {
          setPatch(id, null);
        }
      })();
    },
    [setPatch]
  );

  const handleTogglePin = useCallback(
    (id: string, nextPinned: boolean) => {
      setPatch(id, { isPinned: nextPinned });
      (async () => {
        try {
          await tasksRepo.setPinned(id, nextPinned);
          setPatch(id, null);
        } catch {
          setPatch(id, null);
        }
      })();
    },
    [setPatch]
  );

  const editor = useTaskEditor();

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
          onPress={editor.openEdit}
        />
      );
    },
    [categoriesById, subtaskCounts, reminderIds, repeatIds, handleToggleComplete, handleTogglePin, editor.openEdit]
  );

  const keyExtractor = useCallback((task: Task) => task.id, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.color.background }]} edges={['top']}>
      {/* No big "Tasks" header — pills sit at the top under the status bar,
          matching inspiration/app/tasks.jpeg. The Tasks tab itself is named
          in the bottom tab bar already, so a duplicate title is wasted space. */}
      <View style={{ paddingTop: t.spacing.sm }}>
        <CategoryPills
          categories={categories}
          selectedId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => {
          const isFirst = sections[0]?.key === section.key;
          return (
            <View
              style={[
                styles.sectionHeader,
                {
                  paddingTop: isFirst ? 6 : t.spacing.xl,
                  paddingBottom: t.spacing.sm,
                },
              ]}
            >
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontSize: t.fontSize.lg,
                  fontWeight: t.fontWeight.bold,
                  flex: 1,
                }}
              >
                {section.title}
              </Text>
              {/* Collapse chevron — visual only for now; collapse logic
                  arrives later. Pointing up matches the inspiration's
                  expanded-section state. */}
              <Text
                style={{
                  color: t.color.textMuted,
                  fontSize: t.fontSize.sm,
                  fontWeight: t.fontWeight.bold,
                }}
              >
                ▴
              </Text>
            </View>
          );
        }}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: t.spacing.xl,
            paddingTop: 0,
            paddingBottom: t.spacing['5xl'],
          },
        ]}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={{ paddingTop: t.spacing['2xl'] }}>
            {loading ? (
              <Loading />
            ) : error ? (
              <ErrorState message={error} onRetry={refresh} />
            ) : (
              <EmptyState filtered={selectedCategoryId !== null} />
            )}
          </View>
        }
        keyboardShouldPersistTaps="handled"
      />

      <Fab
        onPress={editor.openCreate}
        accessibilityLabel="Add task"
        hint="Opens the task composer"
      />

      <TaskComposer {...editor.composerProps} />
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
  listContent: {},
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
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
