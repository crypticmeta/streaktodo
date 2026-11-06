import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarGrid } from '../../src/components/CalendarGrid';
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
  type Task,
  type ReminderScheduleState,
} from '../../src/db';
import { addMonths, addDays, isSameDay, startOfDay, startOfMonth } from '../../src/lib/date';
import * as analytics from '../../src/lib/analytics';
import * as scheduler from '../../src/lib/notificationScheduler';
import { completeTaskWithFollowUp, reopenTaskAndReminder } from '../../src/lib/taskActions';
import { useTaskEditor } from '../../src/lib/useTaskEditor';
import { useTodayStart } from '../../src/lib/useToday';
import { useTheme } from '../../src/theme';

// Local optimistic patch applied on top of a Task while a write is in flight.
type Patch = Partial<Pick<Task, 'status' | 'isPinned' | 'completedAt'>>;

export default function CalendarScreen() {
  const t = useTheme();

  const [month, setMonth] = useState<number>(() => startOfMonth());
  const [selectedDay, setSelectedDay] = useState<number>(() => startOfDay());
  const [calendarCollapsed, setCalendarCollapsed] = useState(false);
  const today = useTodayStart();

  // Tasks for the selected day. We pass dueAtMin = dueAtMax = day so the
  // serialized filter key changes whenever the user picks a new day.
  const { tasks, loading, error, refresh } = useTasks({
    status: 'all',
    dueAtMin: selectedDay,
    dueAtMax: selectedDay,
    pinnedFirst: false,
  });

  // Marker dots: distinct due-days within the visible month (plus a small
  // overlap window so the surrounding-month cells in the grid also light up
  // correctly). Refresh whenever the month changes or after any edit.
  const [markedDays, setMarkedDays] = useState<Set<number>>(() => new Set());
  const monthWindow = useMemo(() => {
    const start = startOfMonth(month);
    const end = addDays(addMonths(start, 1), 6);
    const trailingStart = addDays(start, -7);
    return { from: trailingStart, to: end };
  }, [month]);

  // Markers refresh when the visible month changes OR any mutation fires.
  const dbVersion = useDbVersion('tasks-changed');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const set = await tasksRepo.listDueDaysInRange({
          fromTs: monthWindow.from,
          toTs: monthWindow.to,
        });
        if (!cancelled) setMarkedDays(set);
      } catch {
        if (!cancelled) setMarkedDays(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [monthWindow.from, monthWindow.to, dbVersion]);

  const { categories } = useCategories();
  const categoriesById = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null }>();
    for (const c of categories) m.set(c.id, { name: c.name, color: c.color });
    return m;
  }, [categories]);

  // Per-row meta queries; refresh on dbVersion bump too.
  const taskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const taskIdsKey = taskIds.join('|');
  const [subtaskCounts, setSubtaskCounts] = useState<
    Record<string, { total: number; done: number }>
  >({});
  const [reminderIds, setReminderIds] = useState<Set<string>>(() => new Set());
  const [reminderHealth, setReminderHealth] = useState<Record<string, ReminderScheduleState>>({});
  const [repeatIds, setRepeatIds] = useState<Set<string>>(() => new Set());
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

  // Optimistic patches mirror the home screen so completing/pinning here
  // feels instant.
  const [optimistic, setOptimistic] = useState<Record<string, Patch>>({});
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

  const visibleTasks = useMemo(() => {
    if (Object.keys(optimistic).length === 0) return tasks;
    return tasks.map((task) => {
      const p = optimistic[task.id];
      return p ? { ...task, ...p } : task;
    });
  }, [tasks, optimistic]);

  const tasksById = useMemo(() => {
    const byId = new Map<string, Task>();
    for (const task of visibleTasks) byId.set(task.id, task);
    return byId;
  }, [visibleTasks]);

  const trackTaskStatusChange = useCallback((
    task: Task,
    event: 'task_completed' | 'task_uncompleted'
  ) => {
    void analytics.track(event, {
      source: 'calendar',
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

  const handleToggleComplete = useCallback(
    (id: string, nextStatus: 'done' | 'pending') => {
      const task = tasksById.get(id);
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
              nextStatus === 'done' ? 'task_completed' : 'task_uncompleted'
            );
          }
          // Refresh happens automatically via the tasks-changed event
          // emitted by completeTask / uncompleteTask / spawnNextOccurrence.
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

  // Edits and creates refresh the day list and marker dots through DB events.
  const editor = useTaskEditor();

  const handleCalendarChange = useCallback((next: number) => {
    setMonth(next);
    if (calendarCollapsed) setSelectedDay(startOfDay(next));
  }, [calendarCollapsed]);

  const handleSelectDay = useCallback((day: number) => {
    const normalized = startOfDay(day);
    setSelectedDay(normalized);
    setMonth(calendarCollapsed ? normalized : startOfMonth(normalized));
  }, [calendarCollapsed]);

  const dayLabel = useMemo(() => {
    if (isSameDay(selectedDay, today)) return 'Today';
    const d = new Date(selectedDay);
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
  }, [selectedDay, today]);

  const renderTask = useCallback(({ item }: { item: Task }) => {
    const category = item.categoryId ? categoriesById.get(item.categoryId) ?? null : null;
    return (
      <TaskRow
        task={item}
        category={category}
        subtaskCounts={subtaskCounts[item.id]}
        hasReminder={reminderIds.has(item.id)}
        reminderState={reminderHealth[item.id]}
        hasRepeat={repeatIds.has(item.id)}
        onToggleComplete={handleToggleComplete}
        onTogglePin={handleTogglePin}
        onPress={editor.openEdit}
      />
    );
  }, [
    categoriesById,
    subtaskCounts,
    reminderIds,
    reminderHealth,
    repeatIds,
    handleToggleComplete,
    handleTogglePin,
    editor.openEdit,
  ]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.color.background }]} edges={['top']}>
      <FlatList
        data={visibleTasks}
        keyExtractor={(task) => task.id}
        renderItem={renderTask}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        refreshing={loading}
        onRefresh={() => { void refresh(); }}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: t.spacing.xl, paddingBottom: t.spacing['6xl'] },
        ]}
        ListHeaderComponent={(
          <>
        <View style={[styles.headerRow, { marginTop: t.spacing.sm, marginBottom: t.spacing.md }]}>
          <View style={{ flex: 1 }}>
            <View style={[styles.dayKicker, { backgroundColor: t.color.infoSoft, borderRadius: t.radius.pill }]}>
              <Icon name="calendar-tab-filled" size={13} color={t.color.info} />
              <Text style={{ color: t.color.info, fontSize: t.fontSize.xs, fontWeight: t.fontWeight.bold, letterSpacing: t.tracking.wide }}>
                DAY VIEW
              </Text>
            </View>
            <Text
              style={{
                color: t.color.textPrimary,
                fontSize: t.fontSize['2xl'],
                fontWeight: t.fontWeight.heavy,
              }}
            >
              {dayLabel}
            </Text>
          </View>
          {!isSameDay(selectedDay, today) ? (
            <Pressable
              onPress={() => {
                setSelectedDay(today);
                setMonth(startOfMonth(today));
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Jump to today"
              style={({ pressed }) => [
                styles.todayButton,
                {
                  backgroundColor: pressed ? t.color.warnSoft : t.color.surface,
                  borderRadius: t.radius.pill,
                  marginRight: t.spacing.sm,
                },
              ]}
            >
              <Text style={{ color: t.color.textPrimary, fontSize: t.fontSize.sm, fontWeight: t.fontWeight.semibold }}>
                Today
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              setCalendarCollapsed((wasCollapsed) => {
                // Snap the anchor so the visible window keeps the selected day
                // in view across the mode switch. Going to week-mode: anchor on
                // the day. Going back to month-mode: anchor on the day's month.
                if (wasCollapsed) setMonth(startOfMonth(selectedDay));
                else setMonth(startOfDay(selectedDay));
                return !wasCollapsed;
              });
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={calendarCollapsed ? 'Expand calendar' : 'Collapse calendar'}
            accessibilityState={{ expanded: !calendarCollapsed }}
            style={({ pressed }) => [
              styles.collapseButton,
              {
                backgroundColor: pressed ? t.color.accentMuted : t.color.surfaceMuted,
                borderRadius: t.radius.pill,
              },
            ]}
          >
            <Icon
              name={calendarCollapsed ? 'chevron-down' : 'chevron-up'}
              size={18}
              color={t.color.textPrimary}
            />
          </Pressable>
        </View>

        <View
          style={{
            backgroundColor: t.color.infoSoft,
            borderColor: t.color.infoSoft,
            borderWidth: 1,
            borderRadius: t.radius['2xl'],
            padding: t.spacing.lg,
            ...t.elevation.sm,
          }}
        >
          <CalendarGrid
            month={month}
            onMonthChange={handleCalendarChange}
            selected={selectedDay}
            onSelect={handleSelectDay}
            markedDays={markedDays}
            disablePast={false}
            mode={calendarCollapsed ? 'week' : 'month'}
          />
        </View>

        <View style={{ marginTop: t.spacing['2xl'] }}>
          <Text
            style={{
              color: t.color.textMuted,
              fontSize: t.fontSize.xs,
              fontWeight: t.fontWeight.semibold,
              letterSpacing: t.tracking.wide,
              textTransform: 'uppercase',
              marginBottom: visibleTasks.length === 0 ? 0 : t.spacing.sm,
            }}
          >
            {visibleTasks.length === 0
              ? 'Nothing scheduled'
              : `${visibleTasks.length} ${visibleTasks.length === 1 ? 'task' : 'tasks'}`}
          </Text>

          {error ? (
            <View style={{ paddingVertical: t.spacing['2xl'], alignItems: 'center' }}>
              <Text style={{ color: t.color.danger, fontSize: t.fontSize.sm, textAlign: 'center' }}>
                Couldn’t load this day. {error}
              </Text>
              <Pressable
                onPress={() => { void refresh(); }}
                accessibilityRole="button"
                accessibilityLabel="Retry loading this day"
                style={{ marginTop: t.spacing.sm, padding: t.spacing.sm }}
              >
                <Text style={{ color: t.color.accent, fontSize: t.fontSize.sm, fontWeight: t.fontWeight.bold }}>
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : visibleTasks.length === 0 ? (
            <View
              style={{
                paddingVertical: t.spacing['2xl'],
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: t.color.textMuted,
                  fontSize: t.fontSize.sm,
                }}
              >
                Tap + to add a task for this day.
              </Text>
            </View>
          ) : null}
        </View>
          </>
        )}
      />

      <Fab
        onPress={() => editor.openCreate({ dueAt: selectedDay })}
        accessibilityLabel="Add task"
        hint="Opens the task composer"
      />

      <TaskComposer {...editor.composerProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingTop: 8 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayKicker: {
    alignSelf: 'flex-start',
    minHeight: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    marginBottom: 5,
  },
  todayButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  collapseButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
