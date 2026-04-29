/**
 * Notification scheduler.
 *
 * Walks task_reminders rows and arms a local notification per row using
 * expo-notifications. The OS notification id is persisted back onto the
 * row so we can cancel/replace it later.
 *
 * Time-critical reminders use SCHEDULED LOCAL notifications, not background
 * fetch. This is the only reliable approach across iOS BGTaskScheduler and
 * Android Doze (per the SPEC).
 *
 * The scheduler is idempotent: scheduleForTask cancels any existing
 * notification id for each reminder before re-scheduling. reconcileAll on
 * boot re-arms anything missing from the OS queue.
 */

import { Platform } from 'react-native';
import { getDb, remindersRepo } from '../db';

type NotificationsModule = typeof import('expo-notifications');

// Lazy-load expo-notifications. The module isn't available in environments
// where the native pieces haven't been linked yet (e.g. Expo Go before SDK
// 53 dropped remote-push support there). All of our paths gracefully no-op
// if it can't be loaded.
let modulePromise: Promise<NotificationsModule | null> | null = null;
function loadModule(): Promise<NotificationsModule | null> {
  if (!modulePromise) {
    modulePromise = (async () => {
      try {
        return await import('expo-notifications');
      } catch {
        return null;
      }
    })();
  }
  return modulePromise;
}

type PermissionState = 'unknown' | 'granted' | 'denied';
let permissionCache: PermissionState = 'unknown';

function toPermissionState(status: string): PermissionState {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'unknown';
}

/**
 * Ask the OS for notification permission once. Returns the resolved state.
 * Subsequent calls are cached unless the cache is reset (e.g. user toggled
 * permission in system settings — handled by reconcileAll on next boot).
 */
export async function ensurePermission(): Promise<PermissionState> {
  if (permissionCache !== 'unknown') return permissionCache;
  const Notifications = await loadModule();
  if (!Notifications) {
    permissionCache = 'denied';
    return 'denied';
  }

  if (Platform.OS === 'android') {
    // Android 13+ requires a channel before the OS will show the prompt.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  let state = toPermissionState(status);
  if (state === 'unknown') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
    state = toPermissionState(status);
  }
  permissionCache = state;
  return permissionCache;
}

/** Reset the cached permission. Call when the user changes system settings. */
export function resetPermissionCache(): void {
  permissionCache = 'unknown';
}

/**
 * Compute the absolute timestamp at which a reminder should fire.
 * Returns null if the task isn't scheduled enough to fire (no date) or if
 * the resulting time is already in the past.
 *
 * Time math:
 *   - dueAt is start-of-day local epoch ms
 *   - dueTime is minutes since midnight (or null = all-day → fires at 09:00)
 *   - leadMinutes is how far before due time to fire (0 = at time)
 */
export function computeReminderFireAt(args: {
  dueAt: number | null;
  dueTime: number | null;
  leadMinutes: number;
  nowTs?: number;
}): number | null {
  if (args.dueAt === null) return null;
  const minutes = args.dueTime ?? 9 * 60; // default 09:00 for all-day tasks
  const fire = args.dueAt + minutes * 60 * 1000 - args.leadMinutes * 60 * 1000;
  const now = args.nowTs ?? Date.now();
  if (fire <= now) return null;
  return fire;
}

/**
 * Schedule a single OS notification.
 * Returns the OS notification id (so we can cancel/replace it later) or null
 * if scheduling was a no-op (no permission, fire time in the past, etc.).
 */
async function scheduleOne(args: {
  taskId: string;
  taskTitle: string;
  fireAt: number;
}): Promise<string | null> {
  const Notifications = await loadModule();
  if (!Notifications) return null;
  const perm = await ensurePermission();
  if (perm !== 'granted') return null;

  const seconds = Math.max(1, Math.floor((args.fireAt - Date.now()) / 1000));

  return await Notifications.scheduleNotificationAsync({
    content: {
      title: args.taskTitle,
      body: 'Reminder',
      data: { taskId: args.taskId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  });
}

async function cancelOne(scheduledNotificationId: string | null): Promise<void> {
  if (!scheduledNotificationId) return;
  const Notifications = await loadModule();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(scheduledNotificationId);
  } catch {
    // Already gone — ignore.
  }
}

/**
 * Cancel every scheduled notification for a task. Used when the task is
 * completed or deleted. The DB rows themselves are untouched.
 */
export async function cancelForTask(taskId: string): Promise<void> {
  const reminders = await remindersRepo.listRemindersByTask(taskId);
  for (const r of reminders) {
    if (!r.scheduledNotificationId) continue;
    await cancelOne(r.scheduledNotificationId);
    await remindersRepo.updateReminder(r.id, { scheduledNotificationId: null });
  }
}

/**
 * Schedule every active reminder for a task. Cancels any prior schedules
 * first so this is safe to call repeatedly (e.g. after editing a task).
 *
 * Tasks without a due date — and reminders whose computed fire time has
 * already passed — are silently skipped.
 */
export async function scheduleForTask(args: {
  taskId: string;
  taskTitle: string;
  taskDueAt: number | null;
  taskDueTime: number | null;
}): Promise<void> {
  const reminders = await remindersRepo.listRemindersByTask(args.taskId);
  for (const r of reminders) {
    await cancelOne(r.scheduledNotificationId);
    const fireAt = computeReminderFireAt({
      dueAt: args.taskDueAt,
      dueTime: args.taskDueTime,
      leadMinutes: r.leadMinutes,
    });
    if (fireAt === null) {
      await remindersRepo.updateReminder(r.id, { scheduledNotificationId: null });
      continue;
    }
    const id = await scheduleOne({
      taskId: args.taskId,
      taskTitle: args.taskTitle,
      fireAt,
    });
    await remindersRepo.updateReminder(r.id, { scheduledNotificationId: id });
  }
}

/**
 * Boot-time reconcile: walk every active reminder and re-arm anything that
 * doesn't have a live OS notification id, OR whose fire time is in the past.
 *
 * Handles:
 *   - device reboot dropping scheduled notifications
 *   - force-quit on OEMs that lose alarms
 *   - the user revoking + re-granting permission across sessions
 *   - tasks edited while the app was off
 *
 * Best-effort. Failures are swallowed.
 */
export async function reconcileAll(): Promise<void> {
  const Notifications = await loadModule();
  if (!Notifications) return;
  // We don't need to ensurePermission() here — it's fine to no-op when the
  // user hasn't granted yet. If they later grant, the next save reconciles.
  const status = await Notifications.getPermissionsAsync();
  const permissionState = toPermissionState(status.status);
  if (permissionState !== 'granted') {
    permissionCache = permissionState;
    return;
  }
  permissionCache = permissionState;

  const rows = await remindersRepo.listAllActiveRemindersWithTask();
  for (const row of rows) {
    const fireAt = computeReminderFireAt({
      dueAt: row.taskDueAt,
      dueTime: row.taskDueTime,
      leadMinutes: row.leadMinutes,
    });

    if (fireAt === null) {
      // Past due or undated — clear stale id if any.
      if (row.scheduledNotificationId) {
        await cancelOne(row.scheduledNotificationId);
        await remindersRepo.updateReminder(row.reminderId, {
          scheduledNotificationId: null,
        });
      }
      continue;
    }

    // Re-arm. Cancel any prior id first so we never accumulate duplicates.
    await cancelOne(row.scheduledNotificationId);
    const id = await scheduleOne({
      taskId: row.taskId,
      taskTitle: row.taskTitle,
      fireAt,
    });
    await remindersRepo.updateReminder(row.reminderId, {
      scheduledNotificationId: id,
    });
  }
}

/**
 * Dev-only smoke test. Asks for permission via the real `ensurePermission`
 * path (so a regression in the boot-time-cache logic surfaces here too),
 * then schedules a one-shot notification a few seconds out. Persists
 * nothing — no reminder row, no scheduled_notification_id tracked.
 *
 * Returns:
 *   - `'granted'` if the notification was scheduled
 *   - `'denied'`  if the user (or system) refused permission
 *   - `'unknown'` if the native module failed to load
 */
export async function fireDebugNotification(): Promise<PermissionState> {
  const Notifications = await loadModule();
  if (!Notifications) return 'unknown';

  const perm = await ensurePermission();
  if (perm !== 'granted') return perm;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Streak Todo · debug',
      body: 'If you see this, notifications are wired correctly.',
      data: { debug: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
    },
  });
  return 'granted';
}

/**
 * Clear every scheduled OS notification and forget all persisted ids.
 * Used before a full DB restore so stale alarms from the pre-import dataset
 * can't survive into the restored state.
 */
export async function resetAllScheduledNotifications(): Promise<void> {
  const Notifications = await loadModule();
  if (Notifications) {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // Best-effort only.
    }
  }

  const db = await getDb();
  await db.runAsync(
    `UPDATE task_reminders
        SET scheduled_notification_id = NULL
      WHERE scheduled_notification_id IS NOT NULL`
  );
}
