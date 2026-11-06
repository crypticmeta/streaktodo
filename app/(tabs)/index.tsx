import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import {
  CategoryPills,
  UNCATEGORIZED_CATEGORY_FILTER,
} from '../../src/components/CategoryPills';
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
  usePaginatedTasks,
  useTaskCount,
  type ListTasksFilter,
  type Subtask,
  type Task,
  type ReminderScheduleState,
} from '../../src/db';
import * as analytics from '../../src/lib/analytics';
import * as scheduler from '../../src/lib/notificationScheduler';
import { completeTaskWithFollowUp, reopenTaskAndReminder } from '../../src/lib/taskActions';
import { addDays } from '../../src/lib/date';
import { groupTasksIntoSections } from '../../src/lib/taskGrouping';
import { useTaskEditor } from '../../src/lib/useTaskEditor';
import { useTodayStart } from '../../src/lib/useToday';
import { useTheme } from '../../src/theme';

// Local optimistic patch applied on top of a Task while a write is in flight.
type Patch = Partial<Pick<Task, 'status' | 'isPinned' | 'completedAt'>>;
type TaskFocus = 'all' | 'overdue' | 'today' | 'no-date';

const FOCUS_OPTIONS: ReadonlyArray<{ key: TaskFocus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'no-date', label: 'No date' },
];

// SecureStore key for the "Show done" preference. Sticks across launches so
// users don't have to re-toggle every cold start. Versioned suffix lets us
// invalidate later if the meaning changes.
const SHOW_DONE_PREF_KEY = 'tasks_show_done_v1';

export default function TasksScreen() {
  const t = useTheme();
  const today = useTodayStart();
  const router = useRouter();
  const { editTask } = useLocalSearchParams<{ editTask?: string }>();
  const editor = useTaskEditor();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim());
  const [focus, setFocus] = useState<TaskFocus>('all');
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set());
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

  // Push every primary filter into SQLite. This keeps the page bounded even
  // for years of history and makes the matching count exact rather than a
  // count of whatever happens to be loaded in memory.
  const taskFilter = useMemo<ListTasksFilter>(() => {
    const filter: ListTasksFilter = {
      status: focus === 'overdue' ? 'pending' : showDone ? 'all' : 'pending',
      query: deferredQuery || undefined,
    };
    if (selectedCategoryId === UNCATEGORIZED_CATEGORY_FILTER) {
      filter.categoryId = null;
    } else if (selectedCategoryId !== null) {
      filter.categoryId = selectedCategoryId;
    }
    if (focus === 'overdue') filter.dueAtMax = addDays(today, -1);
    if (focus === 'today') {
      filter.dueAtMin = today;
      filter.dueAtMax = today;
    }
    if (focus === 'no-date') filter.dueDate = 'undated';
    return filter;
  }, [selectedCategoryId, deferredQuery, focus, showDone, today]);
  const {
    tasks,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    error,
    refresh,
    loadMore,
  } = usePaginatedTasks(taskFilter);
  const { count: openCount } = useTaskCount({ status: 'pending' });
  const { count: allTaskCount } = useTaskCount({ status: 'all' });
  const { categories } = useCategories();
  const [subtaskCounts, setSubtaskCounts] = useState<
    Record<string, { total: number; done: number }>
  >({});
  const [subtasksByTask, setSubtasksByTask] = useState<Record<string, Subtask[]>>({});
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => new Set());
  const [reminderIds, setReminderIds] = useState<Set<string>>(() => new Set());
  const [reminderHealth, setReminderHealth] = useState<Record<string, ReminderScheduleState>>({});
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
  const taskIdsKey = taskIds.join('|');
  const dbVersion = useDbVersion('tasks-changed');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [counts, health, repeats] = await Promise.all([
          subtasksRepo.countsByTaskIds(taskIds),
          remindersRepo.healthByTaskIds(taskIds),
          repeatRulesRepo.taskIdsWithRepeat(taskIds),
        ]);
        if (cancelled) return;
        setSubtaskCounts(counts);
        setReminderHealth(health);
        setReminderIds(new Set(Object.keys(health)));
        setRepeatIds(repeats);
      } catch {
        if (cancelled) return;
        // The task rows are still useful if optional metadata fails.
        setSubtaskCounts({});
        setReminderHealth({});
        setReminderIds(new Set());
        setRepeatIds(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taskIdsKey, dbVersion]);

  const expandedKey = [...expandedTaskIds].sort().join('|');
  useEffect(() => {
    let cancelled = false;
    const ids = [...expandedTaskIds].filter((id) => taskIds.includes(id));
    if (ids.length === 0) {
      setSubtasksByTask({});
      return;
    }
    void subtasksRepo.listSubtasksByTaskIds(ids)
      .then((rows) => {
        if (!cancelled) setSubtasksByTask(rows);
      })
      .catch(() => {
        if (!cancelled) setSubtasksByTask({});
      });
    return () => { cancelled = true; };
  }, [expandedKey, taskIdsKey, dbVersion]);

  const handleToggleSubtasks = useCallback((taskId: string) => {
    setExpandedTaskIds((previous) => {
      const next = new Set(previous);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  // Effective task list: pinned-first sort already happens in the repo; we
  // overlay optimistic patches on top so completion / pin taps feel instant.
  const visibleTasks = useMemo(() => {
    return Object.keys(optimistic).length === 0 ? tasks : tasks.map((task) => {
      const p = optimistic[task.id];
      return p ? { ...task, ...p } : task;
    });
  }, [tasks, optimistic]);

  const tasksById = useMemo(() => {
    const out = new Map<string, Task>();
    for (const task of visibleTasks) out.set(task.id, task);
    return out;
  }, [visibleTasks]);

  const trackTaskStatusChange = useCallback((
    task: Task,
    event: 'task_completed' | 'task_uncompleted',
    source: 'tasks' | 'subtasks'
  ) => {
    void analytics.track(event, {
      source,
      ...analytics.buildTaskShapeProps({
        hasDueDate: task.dueAt !== null,
        hasTime: task.dueTime !== null,
        hasNotes: Boolean(task.notes?.trim()),
        subtaskCount: subtaskCounts[task.id]?.total ?? 0,
        hasCategory: task.categoryId !== null,
        hasReminder: reminderIds.has(task.id),
        hasRepeat: repeatIds.has(task.id),
      }),
    });
  }, [subtaskCounts, reminderIds, repeatIds]);

  // Bucket into Previous / Today / Upcoming / No Date for SectionList.
  const sections = useMemo(
    () => groupTasksIntoSections(visibleTasks, today).map((section) => ({
      ...section,
      count: section.data.length,
      data: collapsedSections.has(section.key) ? [] : section.data,
    })),
    [visibleTasks, today, collapsedSections]
  );

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!editTask) return;
    void editor.openEdit(editTask).finally(() => {
      router.setParams({ editTask: undefined });
    });
  }, [editTask, editor.openEdit, router]);

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
      const task = tasksById.get(id);
      // Optimistic.
      setPatch(id, {
        status: nextStatus,
        completedAt: nextStatus === 'done' ? Date.now() : null,
      });
      (async () => {
        try {
          if (nextStatus === 'done') {
            await completeTaskWithFollowUp(id);
          } else {
            await reopenTaskAndReminder(id);
          }
          if (task) {
            trackTaskStatusChange(
              task,
              nextStatus === 'done' ? 'task_completed' : 'task_uncompleted',
              'tasks'
            );
          }
          // Refresh happens automatically via the tasks-changed event.
          setPatch(id, null);
        } catch (error) {
          setPatch(id, null);
          Alert.alert(
            'Couldn’t update task',
            error instanceof Error ? error.message : 'Try again in a moment.'
          );
        }
      })();
    },
    [setPatch, tasksById, trackTaskStatusChange]
  );

  const handleTogglePin = useCallback(
    (id: string, nextPinned: boolean) => {
      setPatch(id, { isPinned: nextPinned });
      (async () => {
        try {
          await tasksRepo.setPinned(id, nextPinned);
          setPatch(id, null);
        } catch (error) {
          setPatch(id, null);
          Alert.alert(
            'Couldn’t update pin',
            error instanceof Error ? error.message : 'Try again in a moment.'
          );
        }
      })();
    },
    [setPatch]
  );

  const handleToggleSubtaskComplete = useCallback(
    (subtaskId: string, nextStatus: 'done' | 'pending') => {
      void (async () => {
        let parentTaskId: string | null = null;
        try {
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
              await completeTaskWithFollowUp(parentTaskId);
              trackTaskStatusChange(parent, 'task_completed', 'subtasks');
              setPatch(parentTaskId, null);
            } catch (error) {
              setPatch(parentTaskId, null);
              throw error;
            }
          } else if (nextDoneCount < total && parent.status === 'done') {
            setPatch(parentTaskId, {
              status: 'pending',
              completedAt: null,
            });
            try {
              await reopenTaskAndReminder(parentTaskId);
              trackTaskStatusChange(parent, 'task_uncompleted', 'subtasks');
              setPatch(parentTaskId, null);
            } catch (error) {
              setPatch(parentTaskId, null);
              throw error;
            }
          }
        } catch (error) {
          if (parentTaskId) setPatch(parentTaskId, null);
          Alert.alert(
            'Couldn’t update subtask',
            error instanceof Error ? error.message : 'Try again in a moment.'
          );
        }
      })();
    },
    [subtasksByTask, tasksById, setPatch, trackTaskStatusChange]
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
          subtasks={expandedTaskIds.has(item.id) ? (subtasksByTask[item.id] ?? []) : undefined}
          subtaskCounts={subtaskCounts[item.id]}
          hasReminder={reminderIds.has(item.id)}
          reminderState={reminderHealth[item.id]}
          hasRepeat={repeatIds.has(item.id)}
          onToggleComplete={handleToggleComplete}
          onToggleSubtaskComplete={handleToggleSubtaskComplete}
          onToggleSubtasks={handleToggleSubtasks}
          onTogglePin={handleTogglePin}
          onPress={editor.openEdit}
        />
      );
    },
    [
      categoriesById,
      subtasksByTask,
      expandedTaskIds,
      subtaskCounts,
      reminderIds,
      reminderHealth,
      repeatIds,
      handleToggleComplete,
      handleToggleSubtaskComplete,
      handleToggleSubtasks,
      handleTogglePin,
      editor.openEdit,
    ]
  );

  const keyExtractor = useCallback((task: Task) => task.id, []);
  const hasActiveFilters = selectedCategoryId !== null
    || focus !== 'all'
    || query.trim().length > 0
    || showDone;
  const activeFilterCount = Number(selectedCategoryId !== null)
    + Number(focus !== 'all')
    + Number(query.trim().length > 0)
    + Number(showDone);
  const hasTaskHistory = allTaskCount > 0;
  const clearFilters = useCallback(() => {
    setSelectedCategoryId(null);
    setFocus('all');
    setQuery('');
    setShowDone(false);
    setControlsExpanded(false);
    SecureStore.setItemAsync(SHOW_DONE_PREF_KEY, 'false').catch(() => {});
  }, []);
  const todayLabel = new Date(today).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.color.background }]} edges={['top']}>
      <View style={[styles.workspaceHeader, { paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md }]}>
        <View style={styles.headingBlock}>
          <View style={styles.titleRow}>
            <View style={[styles.questPill, { backgroundColor: t.color.infoSoft, borderRadius: t.radius.pill }]}>
              <Icon name="sparkles" size={13} color={t.color.info} />
              <Text style={{ color: t.color.info, fontSize: t.fontSize.xs, fontWeight: t.fontWeight.bold, letterSpacing: t.tracking.wide }}>
                TODAY’S QUEST
              </Text>
            </View>
            {hasTaskHistory || hasActiveFilters ? (
              <Pressable
                onPress={() => setControlsExpanded((expanded) => !expanded)}
                accessibilityRole="button"
                accessibilityState={{ expanded: controlsExpanded }}
                accessibilityLabel={controlsExpanded ? 'Hide search and filters' : 'Show search and filters'}
                style={({ pressed }) => [
                  styles.refineButton,
                  {
                    backgroundColor: activeFilterCount > 0
                      ? t.color.accentSoft
                      : pressed
                        ? t.color.surfaceMuted
                        : t.color.surface,
                    borderColor: activeFilterCount > 0 ? t.color.accentSoft : t.color.border,
                    borderRadius: t.radius.pill,
                  },
                ]}
              >
                <Icon name="search" size={17} color={activeFilterCount > 0 ? t.color.accent : t.color.textSecondary} />
                <Text style={{ color: activeFilterCount > 0 ? t.color.accent : t.color.textSecondary, fontSize: t.fontSize.sm, fontWeight: t.fontWeight.bold }}>
                  Find
                </Text>
                {activeFilterCount > 0 ? (
                  <View style={[styles.filterCount, { backgroundColor: t.color.accent, borderRadius: t.radius.pill }]}>
                    <Text style={{ color: t.color.textOnAccent, fontSize: t.fontSize.xs, fontWeight: t.fontWeight.bold }}>
                      {activeFilterCount}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
          </View>
          <Text style={{ color: t.color.textPrimary, fontSize: t.fontSize['3xl'], fontWeight: t.fontWeight.heavy, letterSpacing: t.tracking.tight }}>
            {openCount === 0 ? 'Fresh start.' : 'Make today count.'}
          </Text>
          <Text style={{ color: t.color.textSecondary, fontSize: t.fontSize.sm, marginTop: 2 }}>
            {todayLabel} · {hasActiveFilters
              ? `${totalCount} matching`
              : `${openCount} ${openCount === 1 ? 'task' : 'tasks'} open`}
          </Text>
        </View>
        {controlsExpanded ? (
          <View style={[styles.searchField, { backgroundColor: t.color.surface, borderColor: t.color.border, borderRadius: t.radius.lg }]}>
            <Icon name="search" size={18} color={t.color.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search tasks and notes"
              placeholderTextColor={t.color.textMuted}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="Search tasks and notes"
              style={{ flex: 1, color: t.color.textPrimary, fontSize: t.fontSize.md, paddingVertical: 10 }}
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
                <Icon name="close" size={18} color={t.color.textMuted} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {controlsExpanded ? (
        <>
          <View style={{ paddingTop: t.spacing.md }}>
            <CategoryPills
              categories={categories}
              selectedId={selectedCategoryId}
              onSelect={setSelectedCategoryId}
              includeUncategorized
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.focusRow, { paddingHorizontal: t.spacing.xl, paddingBottom: t.spacing.md }]}
            keyboardShouldPersistTaps="handled"
          >
        {FOCUS_OPTIONS.map((option) => {
          const selected = focus === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => setFocus(option.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.focusPill,
                {
                  backgroundColor: selected ? t.color.accent : pressed ? t.color.surfaceMuted : t.color.surface,
                  borderColor: selected ? t.color.accent : t.color.border,
                  borderRadius: t.radius.pill,
                },
              ]}
            >
              <Text style={{ color: selected ? t.color.textOnAccent : t.color.textSecondary, fontSize: t.fontSize.sm, fontWeight: t.fontWeight.semibold }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={handleToggleShowDone}
          accessibilityRole="switch"
          accessibilityLabel="Show completed tasks"
          accessibilityState={{ checked: showDone }}
          style={({ pressed }) => [
            styles.focusPill,
            {
              backgroundColor: showDone ? t.color.accentSoft : pressed ? t.color.surfaceMuted : t.color.surface,
              borderColor: showDone ? t.color.accentSoft : t.color.border,
              borderRadius: t.radius.pill,
            },
          ]}
        >
          <Icon name={showDone ? 'tasks-filled' : 'tasks'} size={14} color={showDone ? t.color.textPrimary : t.color.textMuted} />
          <Text style={{ color: showDone ? t.color.textPrimary : t.color.textSecondary, fontSize: t.fontSize.sm, fontWeight: t.fontWeight.semibold }}>
            {showDone ? 'Done shown' : 'Show done'}
          </Text>
        </Pressable>
        {__DEV__ ? (
          <Pressable
            onPress={async () => {
              try {
                const result = await scheduler.createDebugReminderBatch();
                if (result.permission === 'granted') {
                  if (result.exactAlarm === 'denied') {
                    Alert.alert(
                      'Exact alarms required',
                      'Enable "Alarms & reminders" for Streak Todo first. The test batch is meant to measure exact background timing, so it will not create reminders while Android is still batching them.',
                      [
                        { text: 'Not now', style: 'cancel' },
                        {
                          text: 'Open settings',
                          onPress: () => {
                            void scheduler.openExactAlarmSettings();
                          },
                        },
                      ]
                    );
                    return;
                  }
                  const lines = result.reminders.map((reminder) => {
                    return `${reminder.title} -> ${new Date(reminder.fireAt).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}`;
                  });
                  const baseMessage = `Created ${result.reminders.length} real reminder tasks:\n\n${lines.join('\n')}\n\nClose or background the app and watch delivery timing in Metro logs.`;
                  Alert.alert('Reminder batch created', baseMessage);
                } else if (result.permission === 'denied') {
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
            accessibilityLabel="Create test reminder batch (dev only)"
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
                Test reminders
              </Text>
            </Pressable>
          ) : null}
          </ScrollView>
        </>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => {
          const isFirst = sections[0]?.key === section.key;
          return (
            <Pressable
              onPress={() => toggleSection(section.key)}
              accessibilityRole="button"
              accessibilityState={{ expanded: !collapsedSections.has(section.key) }}
              accessibilityLabel={`${section.title}, ${section.count} tasks`}
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
                {section.title} · {section.count}
              </Text>
              <Icon
                name={collapsedSections.has(section.key) ? 'chevron-down' : 'chevron-up'}
                size={17}
                color={t.color.textMuted}
              />
            </Pressable>
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
        ListEmptyComponent={visibleTasks.length > 0 ? null : (
          <View style={{ paddingTop: hasTaskHistory ? t.spacing['2xl'] : t.spacing.lg }}>
            {loading ? (
              <Loading />
            ) : error ? (
              <ErrorState message={error} onRetry={refresh} />
            ) : (
              <EmptyState
                filtered={hasActiveFilters}
                onClear={clearFilters}
                onCreate={() => editor.openCreate()}
              />
            )}
          </View>
        )}
        ListFooterComponent={tasks.length > 0 && (loadingMore || hasMore || error) ? (
          <View style={[styles.listFooter, { paddingVertical: t.spacing.xl }]}>
            {loadingMore ? (
              <ActivityIndicator color={t.color.accent} accessibilityLabel="Loading more tasks" />
            ) : (
              <Pressable
                onPress={() => { void (hasMore ? loadMore() : refresh()); }}
                accessibilityRole="button"
                accessibilityLabel={hasMore ? 'Load more tasks' : 'Retry loading tasks'}
                style={({ pressed }) => [
                  styles.loadMoreButton,
                  {
                    borderColor: error ? t.color.danger : t.color.borderStrong,
                    backgroundColor: pressed ? t.color.surfaceMuted : t.color.surface,
                    borderRadius: t.radius.pill,
                  },
                ]}
              >
                <Text style={{ color: error ? t.color.danger : t.color.textSecondary, fontSize: t.fontSize.sm, fontWeight: t.fontWeight.semibold }}>
                  {error ? 'Try loading again' : `Load more · ${tasks.length} of ${totalCount}`}
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => {
          if (collapsedSections.size === 0) void loadMore();
        }}
        onEndReachedThreshold={0.4}
        onRefresh={() => { void refresh(); }}
        refreshing={loading && tasks.length > 0}
      />

      {hasTaskHistory || hasActiveFilters ? (
        <Fab
          onPress={editor.openCreate}
          accessibilityLabel="Add task"
          hint="Opens the task composer"
        />
      ) : null}

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

function EmptyState({
  filtered,
  onClear,
  onCreate,
}: {
  filtered: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.centered}>
      <View
        style={[
          styles.emptyCard,
          {
            backgroundColor: filtered ? t.color.surface : t.color.infoSoft,
            borderColor: filtered ? t.color.border : t.color.infoSoft,
            borderRadius: t.radius['2xl'],
            padding: t.spacing['2xl'],
            ...t.elevation.sm,
          },
        ]}
      >
        <View style={[styles.emptyIcon, { backgroundColor: t.color.surface, borderRadius: t.radius.pill }]}>
          <Icon name={filtered ? 'search' : 'rocket'} size={28} color={filtered ? t.color.info : t.color.accent} />
        </View>
        <Text
          style={{
            color: t.color.textPrimary,
            fontSize: t.fontSize.lg,
            fontWeight: t.fontWeight.bold,
          }}
        >
          {filtered ? 'Nothing hiding here' : 'A beautifully blank day'}
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
            ? 'Try a different search or clear this view.'
            : 'Plant one small task and give your streak somewhere to begin.'}
        </Text>
        <Pressable
          onPress={filtered ? onClear : onCreate}
          accessibilityRole="button"
          accessibilityLabel={filtered ? 'Clear task filters' : 'Add first task'}
          style={({ pressed }) => [
            styles.retryButton,
            {
              borderColor: t.color.accent,
              borderRadius: t.radius.pill,
              backgroundColor: filtered
                ? pressed ? t.color.accentSoft : 'transparent'
                : t.color.accent,
              opacity: pressed ? 0.82 : 1,
            },
          ]}
        >
          {!filtered ? <Icon name="plus" size={17} color={t.color.textOnAccent} /> : null}
          <Text style={{ color: filtered ? t.color.accent : t.color.textOnAccent, fontSize: t.fontSize.sm, fontWeight: t.fontWeight.bold }}>
            {filtered ? 'Clear filters' : 'Add my first task'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  workspaceHeader: { gap: 14 },
  headingBlock: {},
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  questPill: {
    alignSelf: 'flex-start',
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },
  searchField: {
    minHeight: 46,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  refineButton: {
    minHeight: 44,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
  },
  filterCount: {
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  focusRow: { gap: 8, alignItems: 'center' },
  focusPill: {
    minHeight: 36,
    paddingHorizontal: 13,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listContent: {},
  listFooter: { alignItems: 'center' },
  loadMoreButton: {
    minHeight: 42,
    minWidth: 180,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  emptyIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    minHeight: 44,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  devNotifButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
