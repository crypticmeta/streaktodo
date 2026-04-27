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
  type ScheduleDraft,
} from '../components/scheduleTypes';
import { tasksRepo, type Task } from '../db';
import type { CreateTaskFullInput, TaskGraph } from '../db/repos/tasks';
import * as scheduler from './notificationScheduler';

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

type UseTaskEditorOptions = {
  /** Called after any successful create/update/delete so the screen can re-query. */
  onChanged: () => Promise<void> | void;
};

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

export function useTaskEditor({ onChanged }: UseTaskEditorOptions): UseTaskEditorReturn {
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
    async ({ title, subtasks, categoryId, schedule }: ComposerSubmitInput) => {
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
      }
      await onChanged();
    },
    [editingTaskId, onChanged]
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
              onClose();
              await onChanged();
            } catch {
              // best-effort
            }
          },
        },
      ]
    );
  }, [editingTaskId, onChanged, onClose]);

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
