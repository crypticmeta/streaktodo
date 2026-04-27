import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
} from '../../src/db';
import { addMonths, addDays, isSameDay, startOfDay, startOfMonth } from '../../src/lib/date';
import * as scheduler from '../../src/lib/notificationScheduler';
import { useTaskEditor } from '../../src/lib/useTaskEditor';
import { useTheme } from '../../src/theme';

// Local optimistic patch applied on top of a Task while a write is in flight.
type Patch = Partial<Pick<Task, 'status' | 'isPinned' | 'completedAt'>>;

export default function CalendarScreen() {
  const t = useTheme();

  const [month, setMonth] = useState<number>(() => startOfMonth());
  const [selectedDay, setSelectedDay] = useState<number>(() => startOfDay());
  const [calendarCollapsed, setCalendarCollapsed] = useState(false);
  const today = useMemo(() => startOfDay(), []);

  // Tasks for the selected day. We pass dueAtMin = dueAtMax = day so the
  // serialized filter key changes whenever the user picks a new day.
  const { tasks, refresh } = useTasks({
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
      const set = await tasksRepo.listDueDaysInRange({
        fromTs: monthWindow.from,
        toTs: monthWindow.to,
      });
      if (!cancelled) setMarkedDays(set);
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
  const [subtaskCounts, setSubtaskCounts] = useState<
    Record<string, { total: number; done: number }>
  >({});
  const [reminderIds, setReminderIds] = useState<Set<string>>(() => new Set());
  const [repeatIds, setRepeatIds] = useState<Set<string>>(() => new Set());
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

  const handleToggleComplete = useCallback(
    (id: string, nextStatus: 'done' | 'pending') => {
      setPatch(id, {
        status: nextStatus,
        completedAt: nextStatus === 'done' ? Date.now() : null,
      });
      (async () => {
        try {
          if (nextStatus === 'done') {
            await tasksRepo.completeTask(id);
            void scheduler.cancelForTask(id);
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
            const tk = await tasksRepo.getTaskById(id);
            if (tk && tk.dueAt !== null) {
              void scheduler.scheduleForTask({
                taskId: tk.id,
                taskTitle: tk.title,
                taskDueAt: tk.dueAt,
                taskDueTime: tk.dueTime,
              });
            }
          }
          // Refresh happens automatically via the tasks-changed event
          // emitted by completeTask / uncompleteTask / spawnNextOccurrence.
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

  // Editor — create-on-day uses openCreate but we'd need to prefill; for V0
  // creating from the calendar lands a task with no date. Editing works as
  // expected; the dbVersion subscription above takes care of refreshing the
  // markers + day list when the editor commits.
  const editor = useTaskEditor();

  const dayLabel = useMemo(() => {
    if (isSameDay(selectedDay, today)) return 'Today';
    const d = new Date(selectedDay);
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
  }, [selectedDay, today]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.color.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: t.spacing.xl, paddingBottom: t.spacing['6xl'] },
        ]}
      >
        <View style={[styles.headerRow, { marginTop: t.spacing.sm, marginBottom: t.spacing.md }]}>
          <Text
            style={{
              color: t.color.textPrimary,
              fontSize: t.fontSize['2xl'],
              fontWeight: t.fontWeight.bold,
              flex: 1,
            }}
          >
            {dayLabel}
          </Text>
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
                  backgroundColor: pressed ? t.color.accentMuted : t.color.surfaceMuted,
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
            backgroundColor: t.color.surfaceMuted,
            borderRadius: t.radius['2xl'],
            padding: t.spacing.lg,
          }}
        >
          <CalendarGrid
            month={month}
            onMonthChange={setMonth}
            selected={selectedDay}
            onSelect={setSelectedDay}
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
              marginBottom: t.spacing.sm,
            }}
          >
            {visibleTasks.length === 0
              ? 'Nothing scheduled'
              : `${visibleTasks.length} ${visibleTasks.length === 1 ? 'task' : 'tasks'}`}
          </Text>

          {visibleTasks.length === 0 ? (
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
          ) : (
            <View style={{ gap: 6 }}>
              {visibleTasks.map((task) => {
                const cat = task.categoryId ? categoriesById.get(task.categoryId) ?? null : null;
                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    category={cat}
                    subtaskCounts={subtaskCounts[task.id]}
                    hasReminder={reminderIds.has(task.id)}
                    hasRepeat={repeatIds.has(task.id)}
                    onToggleComplete={handleToggleComplete}
                    onTogglePin={handleTogglePin}
                    onPress={editor.openEdit}
                  />
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Fab
        onPress={editor.openCreate}
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
