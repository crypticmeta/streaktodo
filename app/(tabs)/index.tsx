import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { CategoryPills } from '../../src/components/CategoryPills';
import { Fab } from '../../src/components/Fab';
import { Icon } from '../../src/components/Icon';
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
  type Subtask,
  type Task,
} from '../../src/db';
import * as analytics from '../../src/lib/analytics';
import * as scheduler from '../../src/lib/notificationScheduler';
import { groupTasksIntoSections } from '../../src/lib/taskGrouping';
import { useTaskEditor } from '../../src/lib/useTaskEditor';
import { useTheme } from '../../src/theme';

// Local optimistic patch applied on top of a Task while a write is in flight.
type Patch = Partial<Pick<Task, 'status' | 'isPinned' | 'completedAt'>>;

// SecureStore key for the "Show done" preference. Sticks across launches so
// users don't have to re-toggle every cold start. Versioned suffix lets us
// invalidate later if the meaning changes.
const SHOW_DONE_PREF_KEY = 'tasks_show_done_v1';

export default function TasksScreen() {
  const t = useTheme();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  // Show-done toggle: when off, the list filters out completed tasks (the
  // SQL repo handles this via `status: 'pending'`). Default off so a fresh
  // view feels like a clean to-do list. Hydrated from SecureStore on mount.
  const [showDone, setShowDone] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await SecureStore.getItemAsync(SHOW_DONE_PREF_KEY);
        if (!cancelled && v === 'true') setShowDone(true);
      } catch {
        // SecureStore can fail in odd environments; default (off) is fine.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleShowDone = useCallback(() => {
    setShowDone((prev) => {
      const next = !prev;
      // Best-effort persist — if it fails the toggle still works for the
      // current session, just doesn't survive a relaunch.
      SecureStore.setItemAsync(SHOW_DONE_PREF_KEY, next ? 'true' : 'false').catch(() => {});
      return next;
    });
  }, []);

  // useTasks filter: categoryId undefined = "All" (no filter); a string id =
  // tasks in that category. We never pass null here (which would mean "no
  // category" — a niche case we'll expose later if needed).
  // Status: 'all' includes done; 'pending' hides done. Skipped status is
  // never reached today but the filter is honest about it.
  const taskStatus = showDone ? 'all' : 'pending';
  const { tasks, loading, error, refresh } = useTasks(
    selectedCategoryId !== null
      ? { status: taskStatus, categoryId: selectedCategoryId }
      : { status: taskStatus }
  );
  const { categories } = useCategories();
  const [subtaskCounts, setSubtaskCounts] = useState<
    Record<string, { total: number; done: number }>
  >({});
  const [subtasksByTask, setSubtasksByTask] = useState<Record<string, Subtask[]>>({});
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
      const [counts, subtasks, reminders, repeats] = await Promise.all([
        subtasksRepo.countsByTaskIds(taskIds),
        subtasksRepo.listSubtasksByTaskIds(taskIds),
        remindersRepo.taskIdsWithReminders(taskIds),
        repeatRulesRepo.taskIdsWithRepeat(taskIds),
      ]);
      if (cancelled) return;
      setSubtaskCounts(counts);
      setSubtasksByTask(subtasks);
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

  const tasksById = useMemo(() => {
    const out = new Map<string, Task>();
    for (const task of visibleTasks) out.set(task.id, task);
    return out;
  }, [visibleTasks]);

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
            void analytics.track('task_completed');
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
            void analytics.track('task_uncompleted');
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

  const handleToggleSubtaskComplete = useCallback(
    (subtaskId: string, nextStatus: 'done' | 'pending') => {
      void (async () => {
        let parentTaskId: string | null = null;
        let total = 0;
        let nextDoneCount = 0;

        for (const [taskId, subtasks] of Object.entries(subtasksByTask)) {
          const found = subtasks.find((subtask) => subtask.id === subtaskId);
          if (!found) continue;
          parentTaskId = taskId;
          total = subtasks.length;
          nextDoneCount = subtasks.reduce((count, subtask) => {
            if (subtask.id === subtaskId) {
              return count + (nextStatus === 'done' ? 1 : 0);
            }
            return count + (subtask.status === 'done' ? 1 : 0);
          }, 0);
          break;
        }

        await subtasksRepo.updateSubtask(subtaskId, { status: nextStatus });

        if (!parentTaskId || total === 0) return;
        const parent = tasksById.get(parentTaskId);
        if (!parent) return;

        if (nextDoneCount === total && parent.status !== 'done') {
          setPatch(parentTaskId, {
            status: 'done',
            completedAt: Date.now(),
          });
          try {
            await tasksRepo.completeTask(parentTaskId);
            void analytics.track('task_completed');
            void scheduler.cancelForTask(parentTaskId);
            try {
              const spawned = await tasksRepo.spawnNextOccurrence(parentTaskId);
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
            setPatch(parentTaskId, null);
          } catch {
            setPatch(parentTaskId, null);
          }
        } else if (nextDoneCount < total && parent.status === 'done') {
          setPatch(parentTaskId, {
            status: 'pending',
            completedAt: null,
          });
          try {
            await tasksRepo.uncompleteTask(parentTaskId);
            void analytics.track('task_uncompleted');
            if (parent.dueAt !== null) {
              void scheduler.scheduleForTask({
                taskId: parent.id,
                taskTitle: parent.title,
                taskDueAt: parent.dueAt,
                taskDueTime: parent.dueTime,
              });
            }
            setPatch(parentTaskId, null);
          } catch {
            setPatch(parentTaskId, null);
          }
        }
      })();
    },
    [subtasksByTask, tasksById, setPatch]
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
          subtasks={subtasksByTask[item.id]}
          subtaskCounts={subtaskCounts[item.id]}
          hasReminder={reminderIds.has(item.id)}
          hasRepeat={repeatIds.has(item.id)}
          onToggleComplete={handleToggleComplete}
          onToggleSubtaskComplete={handleToggleSubtaskComplete}
          onTogglePin={handleTogglePin}
          onPress={editor.openEdit}
        />
      );
    },
    [
      categoriesById,
      subtasksByTask,
      subtaskCounts,
      reminderIds,
      repeatIds,
      handleToggleComplete,
      handleToggleSubtaskComplete,
      handleTogglePin,
      editor.openEdit,
    ]
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

      <View
        style={{
          flexDirection: 'row',
          // Dev: debug button on the left, show-done on the right.
          // Production: __DEV__ branch is dead-code-eliminated, leaving a
          // single right-aligned show-done pill (visually identical to
          // before).
          justifyContent: __DEV__ ? 'space-between' : 'flex-end',
          alignItems: 'center',
          paddingHorizontal: t.spacing.xl,
          paddingTop: t.spacing.sm,
          paddingBottom: t.spacing.xs,
        }}
      >
        {/* Dev-only smoke test for the notification permission + scheduling
            pipeline. Schedules a one-shot notification 3s out via the same
            `ensurePermission` path the real reminder flow uses, so a
            regression in either layer surfaces here. Stripped from
            production via __DEV__ + bundler dead-code elimination. */}
        {__DEV__ ? (
          <Pressable
            onPress={async () => {
              try {
                const result = await scheduler.fireDebugNotification();
                if (result === 'granted') {
                  Alert.alert(
                    'Notification scheduled',
                    'Should fire in ~3 seconds. Background the app or watch the tray.'
                  );
                } else if (result === 'denied') {
                  Alert.alert(
                    'Permission denied',
                    'Enable notifications in system settings, then try again.'
                  );
                } else {
                  Alert.alert(
                    'Module unavailable',
                    'expo-notifications failed to load. Likely an Expo Go runtime — needs a dev build.'
                  );
                }
              } catch (err) {
                Alert.alert(
                  'Notification error',
                  err instanceof Error ? err.message : 'Unknown error.'
                );
              }
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Fire test notification (dev only)"
            style={({ pressed }) => [
              styles.devNotifButton,
              {
                backgroundColor: pressed ? t.color.surfaceMuted : 'transparent',
                borderRadius: t.radius.pill,
                borderColor: t.color.borderStrong,
                borderWidth: 1,
              },
            ]}
          >
            <Icon name="reminder" size={14} color={t.color.textMuted} />
            <Text
              style={{
                color: t.color.textMuted,
                fontSize: t.fontSize.xs,
                fontWeight: t.fontWeight.semibold,
              }}
            >
              Test notif
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={handleToggleShowDone}
          hitSlop={6}
          accessibilityRole="switch"
          accessibilityLabel="Show completed tasks"
          accessibilityState={{ checked: showDone }}
          style={({ pressed }) => [
            styles.showDoneToggle,
            {
              backgroundColor: showDone
                ? t.color.accentSoft
                : pressed
                  ? t.color.surfaceMuted
                  : 'transparent',
              borderRadius: t.radius.pill,
            },
          ]}
        >
          <Icon
            name={showDone ? 'tasks-filled' : 'tasks'}
            size={14}
            color={showDone ? t.color.textPrimary : t.color.textMuted}
          />
          <Text
            style={{
              color: showDone ? t.color.textPrimary : t.color.textMuted,
              fontSize: t.fontSize.xs,
              fontWeight: t.fontWeight.semibold,
            }}
          >
            {showDone ? 'Showing done' : 'Show done'}
          </Text>
        </Pressable>
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
  showDoneToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  devNotifButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
