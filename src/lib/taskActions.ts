import { tasksRepo } from '../db';
import * as scheduler from './notificationScheduler';

/** One user action, one idempotent DB mutation, then best-effort OS effects. */
export async function completeTaskWithFollowUp(taskId: string) {
  const result = await tasksRepo.completeTaskAndSpawnNext(taskId);
  await scheduler.cancelForTask(taskId).catch(() => {});
  if (result.changed && result.spawned?.dueAt !== null && result.spawned) {
    await scheduler.scheduleForTask({
      taskId: result.spawned.id,
      taskTitle: result.spawned.title,
      taskDueAt: result.spawned.dueAt,
      taskDueTime: result.spawned.dueTime,
    }).catch(() => {});
  }
  return result;
}

export async function reopenTaskAndReminder(taskId: string): Promise<void> {
  await tasksRepo.uncompleteTask(taskId);
  const task = await tasksRepo.getTaskById(taskId);
  if (!task || task.dueAt === null) return;
  await scheduler.scheduleForTask({
    taskId: task.id,
    taskTitle: task.title,
    taskDueAt: task.dueAt,
    taskDueTime: task.dueTime,
  }).catch(() => {});
}
