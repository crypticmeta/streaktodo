/**
 * useTaskEditor — shared composer state + handlers for any screen that wants
 * to mount the TaskComposer. Returns props you spread onto <TaskComposer />
 * plus an `openCreate()` and `openEdit(taskId)` that screens wire to their
 * FAB and row taps.
 *
 * Lives here (not in the composer) because the composer itself stays a
 * controlled view — the persistence + scheduling side effects belong in the
 * caller's transaction story.
 */
import { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';
import {
  ComposerInitial,
  ComposerSubmitInput,
} from '../components/TaskComposer';
import {
  DEFAULT_REMINDER,
  EMPTY_SCHEDULE,
  type CustomRepeatBody,
  type RepeatDraft,
  type ScheduleDraft,
} from '../components/scheduleTypes';
import { tasksRepo, type Task } from '../db';
import type { CreateTaskFullInput, TaskGraph } from '../db/repos/tasks';
import * as analytics from './analytics';
import * as scheduler from './notificationScheduler';

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

function repeatRuleFromSchedule(s: ScheduleDraft): CreateTaskFullInput['repeatRule'] {
  if (s.repeat.preset === 'none' || s.dueAt === null) return null;
  const d = new Date(s.dueAt);
  // untilAt is allowed on every preset, not just 'custom'. The editor
  // surfaces an end-date picker in the custom sheet, but the persisted
  // rule honours it regardless of which preset emitted the rule.
  const untilAt = s.repeat.untilAt ?? null;
  switch (s.repeat.preset) {
    case 'daily':
      return { freq: 'daily', intervalN: 1, untilAt };
    case 'weekly':
      return { freq: 'weekly', intervalN: 1, byWeekday: WEEKDAY_CODES[d.getDay()], untilAt };
    case 'monthly':
      return { freq: 'monthly', intervalN: 1, byMonthDay: d.getDate(), untilAt };
    case 'yearly':
      return { freq: 'yearly', intervalN: 1, byMonth: d.getMonth() + 1, byMonthDay: d.getDate(), untilAt };
    case 'custom':
      return s.repeat.custom
        ? {
            // Store the actual cadence unit. "Custom" is an editor state,
            // not recurrence math.
            freq: s.repeat.custom.freq,
            intervalN: s.repeat.custom.intervalN,
            byWeekday: s.repeat.custom.byWeekday ?? null,
            byMonthDay: s.repeat.custom.byMonthDay ?? null,
            byMonth: s.repeat.custom.byMonth ?? null,
            untilAt,
          }
        : { freq: 'weekly', intervalN: 1, untilAt };
  }
}

function remindersFromSchedule(s: ScheduleDraft): CreateTaskFullInput['reminders'] {
  if (!s.reminder.enabled || s.dueAt === null) return undefined;
  return [{ leadMinutes: s.reminder.leadMinutes, type: s.reminder.type }];
}

function initialFromGraph(graph: TaskGraph): ComposerInitial {
  const repeat = graph.repeatRule;

  // Round-trip rule:
  //   - DB says `freq === 'custom'` → load as preset='custom' with the body.
  //   - DB says one of the four units AND intervalN === 1 → load as that
  //     preset (the popover will render the standard label).
  //   - DB says one of the four units AND intervalN > 1 → user customized
  //     it, surface as preset='custom' so the custom sheet round-trips.
  const repeatDraft: RepeatDraft = (() => {
    if (!repeat) return EMPTY_SCHEDULE.repeat;
    const isPresetClean = repeat.freq !== 'custom' && repeat.intervalN === 1;
    if (isPresetClean) {
      return {
        preset: repeat.freq,
        untilAt: repeat.untilAt,
      };
    }
    // Custom path. Underlying freq is the DB row's freq when it's a unit;
    // when DB says 'custom' we infer the unit from the body in the same way
    // recurrence.ts does at runtime, so the editor's frequency dropdown
    // shows the right thing.
    const inferredFreq: CustomRepeatBody['freq'] =
      repeat.freq !== 'custom'
        ? (repeat.freq as CustomRepeatBody['freq'])
        : repeat.byWeekday
          ? 'weekly'
          : repeat.byMonth !== null
            ? 'yearly'
            : repeat.byMonthDay !== null
              ? 'monthly'
              : 'daily';
    return {
      preset: 'custom',
      custom: {
        freq: inferredFreq,
        intervalN: repeat.intervalN,
        byWeekday: repeat.byWeekday ?? undefined,
        byMonthDay: repeat.byMonthDay ?? undefined,
        byMonth: repeat.byMonth ?? undefined,
      },
      untilAt: repeat.untilAt,
    };
  })();

  const schedule: ScheduleDraft = {
    dueAt: graph.task.dueAt,
    dueTime: graph.task.dueTime,
    reminder: graph.reminders[0]
      ? {
          enabled: true,
          leadMinutes: graph.reminders[0].leadMinutes,
          // V1 exposes standard local notifications only. Older backups with
          // a dormant alarm/silent value normalize to the supported type.
          type: 'notification',
        }
      : DEFAULT_REMINDER,
    repeat: repeatDraft,
  };

  return {
    title: graph.task.title,
    notes: graph.task.notes,
    subtasks: graph.subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      status: subtask.status,
    })),
    categoryId: graph.task.categoryId,
    schedule,
  };
}

type UseTaskEditorReturn = {
  /** Spread onto <TaskComposer /> */
  composerProps: {
    visible: boolean;
    onClose: () => void;
    initial: ComposerInitial | undefined;
    onSubmit: (input: ComposerSubmitInput) => Promise<void>;
    onDelete: (() => void) | undefined;
  };
  openCreate: (defaults?: { dueAt?: number | null }) => void;
  openEdit: (taskId: string) => Promise<void>;
};

/**
 * No `onChanged` callback needed — every repo write emits `tasks-changed`
 * which fans out to every mounted `useTasks` and `useDbVersion` hook. Each
 * screen's lists / markers / counts refresh themselves.
 */
export function useTaskEditor(): UseTaskEditorReturn {
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingInitial, setEditingInitial] = useState<ComposerInitial | null>(null);

  const openCreate = useCallback((defaults?: { dueAt?: number | null }) => {
    setEditingTaskId(null);
    setEditingInitial(
      defaults?.dueAt !== undefined
        ? {
            title: '',
            notes: null,
            subtasks: [],
            categoryId: null,
            schedule: { ...EMPTY_SCHEDULE, dueAt: defaults.dueAt },
          }
        : null
    );
    setComposerOpen(true);
  }, []);

  const openEdit = useCallback(async (taskId: string) => {
    const graph = await tasksRepo.getTaskGraph(taskId);
    if (!graph) return;
    setEditingTaskId(taskId);
    setEditingInitial(initialFromGraph(graph));
    setComposerOpen(true);
  }, []);

  const onClose = useCallback(() => {
    setComposerOpen(false);
    // Defer clearing edit state by a tick so the close animation reads stable
    // initial data — otherwise the title input briefly shows the create-mode
    // placeholder during the slide-down.
    setTimeout(() => {
      setEditingTaskId(null);
      setEditingInitial(null);
    }, 250);
  }, []);

  const onSubmit = useCallback(
    async ({ title, notes, subtasks, subtaskItems, categoryId, schedule }: ComposerSubmitInput) => {
      const payload: CreateTaskFullInput = {
        task: {
          title,
          notes,
          categoryId,
          dueAt: schedule.dueAt,
          dueTime: schedule.dueTime,
        },
        subtaskTitles: subtasks,
        subtasks: subtaskItems,
        reminders: remindersFromSchedule(schedule),
        repeatRule: repeatRuleFromSchedule(schedule),
      };

      let savedTask: Task;
      const isEdit = editingTaskId !== null;
      if (editingTaskId) {
        // updateTaskFull soft-deletes existing reminder rows, so any prior
        // OS notifications must be cancelled before the new ones are armed.
        const previousTask = await tasksRepo.getTaskById(editingTaskId);
        await scheduler.cancelForTask(editingTaskId);
        try {
          savedTask = await tasksRepo.updateTaskFull(editingTaskId, payload);
        } catch (error) {
          // The DB update is transactional, but cancellation is an OS side
          // effect. Restore the old reminder after a failed save.
          if (previousTask?.dueAt !== null && previousTask) {
            await scheduler.scheduleForTask({
              taskId: previousTask.id,
              taskTitle: previousTask.title,
              taskDueAt: previousTask.dueAt,
              taskDueTime: previousTask.dueTime,
            }).catch(() => {});
          }
          throw error;
        }
      } else {
        savedTask = await tasksRepo.createTaskFull(payload);
      }

      void analytics.track(
        isEdit ? 'task_edited' : 'task_created',
        analytics.buildTaskShapeProps({
          hasDueDate: savedTask.dueAt !== null,
          hasTime: savedTask.dueTime !== null,
          hasNotes: Boolean(savedTask.notes?.trim()),
          subtaskCount: subtaskItems.length,
          hasCategory: savedTask.categoryId !== null,
          hasReminder: payload.reminders !== undefined,
          hasRepeat: payload.repeatRule !== null,
        })
      );

      if (schedule.reminder.enabled && savedTask.dueAt !== null) {
        try {
          const reminderResult = await scheduler.scheduleForTask({
            taskId: savedTask.id,
            taskTitle: savedTask.title,
            taskDueAt: savedTask.dueAt,
            taskDueTime: savedTask.dueTime,
          });
          if (reminderResult.state === 'scheduled') {
            void analytics.track('notification_scheduled', {
              lead_minutes: schedule.reminder.leadMinutes,
              via: isEdit ? 'edit' : 'create',
            });
            if (reminderResult.message) {
              Alert.alert('Reminder scheduled', reminderResult.message, [
                { text: 'Keep best effort' },
                {
                  text: 'Improve accuracy',
                  onPress: () => { void scheduler.openExactAlarmSettings(); },
                },
              ]);
            }
          } else if (reminderResult.message) {
            Alert.alert('Task saved; reminder needs attention', reminderResult.message, [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'Open settings',
                onPress: () => { void Linking.openSettings(); },
              },
            ]);
          }
        } catch (error) {
          // The database save has already committed. Keep that success and
          // report only the secondary OS-side failure.
          Alert.alert(
            'Task saved; reminder needs attention',
            error instanceof Error
              ? error.message
              : 'The operating system could not schedule this reminder.'
          );
        }
      }

      if (schedule.repeat.preset === 'custom' && schedule.repeat.custom) {
        const custom = schedule.repeat.custom;
        const weekdayCount = custom.byWeekday
          ? custom.byWeekday.split(',').filter(Boolean).length
          : 0;
        void analytics.track('custom_repeat_configured', {
          frequency: custom.freq,
          interval: custom.intervalN,
          weekday_count: weekdayCount,
          has_until: schedule.repeat.untilAt != null,
          via: isEdit ? 'edit' : 'create',
        });
      }
    },
    [editingTaskId]
  );

  const onDelete = useCallback(() => {
    if (!editingTaskId) return;
    const id = editingTaskId;
    Alert.alert(
      'Delete task?',
      'The task and its reminders will move to Trash.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            let task: Task | null = null;
            try {
              task = await tasksRepo.getTaskById(id);
              await scheduler.cancelForTask(id);
              await tasksRepo.softDeleteTask(id);
              void analytics.track('task_deleted', {
                source: 'composer',
                had_due_date: task ? task.dueAt !== null : null,
                had_notes: Boolean(task?.notes?.trim()),
                had_category: task ? task.categoryId !== null : null,
              });
              onClose();
              Alert.alert('Moved to Trash', 'You can restore this task now or later from Profile.', [
                { text: 'Done', style: 'cancel' },
                {
                  text: 'Undo',
                  onPress: () => {
                    void (async () => {
                      try {
                        await tasksRepo.restoreTask(id);
                        const restored = await tasksRepo.getTaskById(id);
                        if (restored) {
                          await scheduler.scheduleForTask({
                            taskId: restored.id,
                            taskTitle: restored.title,
                            taskDueAt: restored.dueAt,
                            taskDueTime: restored.dueTime,
                          });
                        }
                      } catch (error) {
                        Alert.alert(
                          'Couldn’t restore task',
                          error instanceof Error ? error.message : 'Try again in a moment.'
                        );
                      }
                    })();
                  },
                },
              ]);
            } catch (error) {
              if (task?.dueAt !== null && task) {
                await scheduler.scheduleForTask({
                  taskId: task.id,
                  taskTitle: task.title,
                  taskDueAt: task.dueAt,
                  taskDueTime: task.dueTime,
                }).catch(() => {});
              }
              Alert.alert(
                'Couldn’t delete task',
                error instanceof Error ? error.message : 'Try again in a moment.'
              );
            }
          },
        },
      ]
    );
  }, [editingTaskId, onClose]);

  return {
    composerProps: {
      visible: composerOpen,
      onClose,
      initial: editingInitial ?? undefined,
      onSubmit,
      onDelete: editingTaskId ? onDelete : undefined,
    },
    openCreate,
    openEdit,
  };
}
