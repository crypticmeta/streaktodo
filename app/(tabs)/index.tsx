import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryPills } from '../../src/components/CategoryPills';
import { Fab } from '../../src/components/Fab';
import { TaskComposer, type ComposerInitial } from '../../src/components/TaskComposer';
import { TaskRow } from '../../src/components/TaskRow';
import { DEFAULT_REMINDER, EMPTY_SCHEDULE, type ScheduleDraft } from '../../src/components/scheduleTypes';
import {
  remindersRepo,
  repeatRulesRepo,
  subtasksRepo,
  tasksRepo,
  useCategories,
  useTasks,
  type Task,
} from '../../src/db';
import type { CreateTaskFullInput, TaskGraph } from '../../src/db/repos/tasks';
import * as scheduler from '../../src/lib/notificationScheduler';
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

// Inverse of the two helpers above: takes a TaskGraph from the DB and produces
// a ComposerInitial the editor can prefill with. The composer carries a
// single-reminder convention (UI shows one row), so we only surface the first
// active reminder when populating; additional reminders survive intact in the
// DB until the user saves, at which point updateTaskFull replaces the set
// with whatever the composer produced.
function initialFromGraph(graph: TaskGraph): ComposerInitial {
  const repeat = graph.repeatRule;
  const schedule: ScheduleDraft = {
    dueAt: graph.task.dueAt,
    dueTime: graph.task.dueTime,
    reminder: graph.reminders[0]
      ? {
          enabled: true,
          leadMinutes: graph.reminders[0].leadMinutes,
          type: graph.reminders[0].type,
          screenLock: false,
        }
      : DEFAULT_REMINDER,
    repeat: repeat
      ? {
          preset: repeat.freq,
          custom:
            repeat.freq === 'custom'
              ? {
                  freq: repeat.freq,
                  intervalN: repeat.intervalN,
                  byWeekday: repeat.byWeekday ?? undefined,
                  byMonthDay: repeat.byMonthDay ?? undefined,
                  byMonth: repeat.byMonth ?? undefined,
                }
              : undefined,
        }
      : EMPTY_SCHEDULE.repeat,
  };

  return {
    title: graph.task.title,
    subtasks: graph.subtaskTitles,
    categoryId: graph.task.categoryId,
    schedule,
  };
}

// Local optimistic patch applied on top of a Task while a write is in flight.
type Patch = Partial<Pick<Task, 'status' | 'isPinned' | 'completedAt'>>;

export default function TasksScreen() {
  const t = useTheme();
  const [composerOpen, setComposerOpen] = useState(false);
  // Edit mode: when set, the composer prefills from `editingInitial` and
  // submits route through updateTaskFull instead of createTaskFull.
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingInitial, setEditingInitial] = useState<ComposerInitial | null>(null);
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
      const payload: CreateTaskFullInput = {
        task: {
          title,
          categoryId,
          dueAt: schedule.dueAt,
          dueTime: schedule.dueTime,
        },
        subtaskTitles: subtasks,
        reminders: remindersFromSchedule(schedule),
        repeatRule: repeatRuleFromSchedule(schedule),
      };

      let savedTask: Task;
      if (editingTaskId) {
        // Edit mode: replace the task graph in place. We also cancel any prior
        // OS notifications because updateTaskFull soft-deletes the existing
        // reminder rows; the new ones get armed below.
        void scheduler.cancelForTask(editingTaskId);
        savedTask = await tasksRepo.updateTaskFull(editingTaskId, payload);
      } else {
        savedTask = await tasksRepo.createTaskFull(payload);
      }

      // Fire-and-forget — the user shouldn't wait on the OS to arm a
      // notification. Failures don't block the save.
      if (schedule.reminder.enabled && savedTask.dueAt !== null) {
        void scheduler.scheduleForTask({
          taskId: savedTask.id,
          taskTitle: savedTask.title,
          taskDueAt: savedTask.dueAt,
          taskDueTime: savedTask.dueTime,
        });
      }
      await refresh();
    },
    [editingTaskId, refresh]
  );

  const handleOpenRow = useCallback(async (taskId: string) => {
    const graph = await tasksRepo.getTaskGraph(taskId);
    if (!graph) return;
    setEditingTaskId(taskId);
    setEditingInitial(initialFromGraph(graph));
    setComposerOpen(true);
  }, []);

  const handleCloseComposer = useCallback(() => {
    setComposerOpen(false);
    // Defer clearing edit state by a tick so the close animation reads the
    // same `initial` it was using when it opened — otherwise the title input
    // briefly shows the create-mode placeholder during the slide-down.
    setTimeout(() => {
      setEditingTaskId(null);
      setEditingInitial(null);
    }, 250);
  }, []);

  const handleDelete = useCallback(() => {
    if (!editingTaskId) return;
    const id = editingTaskId;
    Alert.alert(
      'Delete task?',
      'This will remove the task and its reminders. You can’t undo this yet.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            void scheduler.cancelForTask(id);
            try {
              await tasksRepo.softDeleteTask(id);
              handleCloseComposer();
              await refresh();
            } catch {
              // best-effort
            }
          },
        },
      ]
    );
  }, [editingTaskId, handleCloseComposer, refresh]);

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
          onPress={handleOpenRow}
        />
      );
    },
    [categoriesById, subtaskCounts, reminderIds, repeatIds, handleToggleComplete, handleTogglePin, handleOpenRow]
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
        onPress={() => {
          // Tapping the FAB always opens in CREATE mode — clear any leftover
          // edit state from a previous open.
          setEditingTaskId(null);
          setEditingInitial(null);
          setComposerOpen(true);
        }}
        accessibilityLabel="Add task"
        hint="Opens the task composer"
      />

      <TaskComposer
        visible={composerOpen}
        onClose={handleCloseComposer}
        initial={editingInitial ?? undefined}
        onSubmit={handleSubmit}
        onDelete={editingTaskId ? handleDelete : undefined}
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
