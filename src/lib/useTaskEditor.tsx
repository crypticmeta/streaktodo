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
import { Alert } from 'react-native';
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
            // Persist as 'custom' so we know the user customized something,
            // even if the underlying frequency unit is one of the standard
            // four. The runtime resolves the underlying unit from byWeekday
            // / byMonthDay / byMonth presence.
            freq: 'custom',
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
          type: graph.reminders[0].type,
          screenLock: false,
        }
      : DEFAULT_REMINDER,
    repeat: repeatDraft,
  };

  return {
    title: graph.task.title,
    notes: graph.task.notes,
    subtasks: graph.subtaskTitles,
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
  openCreate: () => void;
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

  const openCreate = useCallback(() => {
    setEditingTaskId(null);
    setEditingInitial(null);
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
    async ({ title, notes, subtasks, categoryId, schedule }: ComposerSubmitInput) => {
      const payload: CreateTaskFullInput = {
        task: {
          title,
          notes,
          categoryId,
          dueAt: schedule.dueAt,
          dueTime: schedule.dueTime,
        },
        subtaskTitles: subtasks,
        reminders: remindersFromSchedule(schedule),
        repeatRule: repeatRuleFromSchedule(schedule),
      };

      let savedTask: Task;
      const isEdit = Boolean(editingTaskId);
      if (editingTaskId) {
        // updateTaskFull soft-deletes existing reminder rows, so any prior
        // OS notifications must be cancelled before the new ones are armed.
        void scheduler.cancelForTask(editingTaskId);
        savedTask = await tasksRepo.updateTaskFull(editingTaskId, payload);
      } else {
        savedTask = await tasksRepo.createTaskFull(payload);
      }

      if (schedule.reminder.enabled && savedTask.dueAt !== null) {
        void scheduler.scheduleForTask({
          taskId: savedTask.id,
          taskTitle: savedTask.title,
          taskDueAt: savedTask.dueAt,
          taskDueTime: savedTask.dueTime,
        });
        void analytics.track('notification_scheduled', {
          lead_minutes: schedule.reminder.leadMinutes,
        });
      }
      if (!isEdit) {
        void analytics.track('task_created', {
          has_due_date: savedTask.dueAt !== null,
          has_time: savedTask.dueTime !== null,
          has_notes: notes !== null && notes.length > 0,
          has_subtasks: subtasks.length > 0,
          has_category: categoryId !== null,
          has_reminder: schedule.reminder.enabled,
          has_repeat: schedule.repeat.preset !== 'none',
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
              void analytics.track('task_deleted');
              onClose();
            } catch {
              // best-effort
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
