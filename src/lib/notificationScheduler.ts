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
import { getDb, remindersRepo, tasksRepo } from '../db';

type NotificationsModule = typeof import('expo-notifications');
type NotificationResponseLike = {
  actionIdentifier: string;
  notification: {
    request: {
      identifier: string;
      content: {
        data?: unknown;
      };
    };
  };
};

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
const REMINDER_CATEGORY_ID = 'REMINDER';
const REMINDER_ACTION_DONE = 'DONE';
const REMINDER_ACTION_SNOOZE = 'SNOOZE_10M';
const SNOOZE_MINUTES = 10;
let categorySetupPromise: Promise<void> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function taskIdFromData(data: unknown): string | null {
  if (!isRecord(data)) return null;
  return typeof data.taskId === 'string' ? data.taskId : null;
}

function isDebugNotificationData(data: unknown): boolean {
  return isRecord(data) && data.debug === true;
}

async function configureNotificationSurface(
  Notifications: NotificationsModule
): Promise<void> {
  if (!categorySetupPromise) {
    categorySetupPromise = (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Reminders',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY_ID, [
        { identifier: REMINDER_ACTION_DONE, buttonTitle: 'Done' },
        { identifier: REMINDER_ACTION_SNOOZE, buttonTitle: 'Snooze 10m' },
      ]);
    })().catch((err) => {
      categorySetupPromise = null;
      throw err;
    });
  }
  await categorySetupPromise;
}

async function scheduleDebugNotificationAt(fireAt: number): Promise<void> {
  const Notifications = await loadModule();
  if (!Notifications) return;
  await configureNotificationSurface(Notifications);

  const seconds = Math.max(1, Math.floor((fireAt - Date.now()) / 1000));
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Streak Todo · debug',
      body: 'Action-button smoke test. Try Done or Snooze 10m.',
      categoryIdentifier: REMINDER_CATEGORY_ID,
      data: { debug: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  });
}

/**
 * Map a permission *response* to our internal state.
 *
 * Android 13+ subtlety: on first launch (before the system popup has been
 * shown), `getPermissionsAsync()` returns `{ status: 'denied', canAskAgain:
 * true }` rather than something like `'undetermined'`. If we treat that as
 * a real `'denied'`, the in-memory cache gets poisoned at boot via
 * reconcileAll, and ensurePermission() short-circuits forever — the
 * request popup never fires.
 *
 * The reliable signal is `canAskAgain`: when it's true, the user hasn't
 * actually denied — they just haven't been asked. Treat that as 'unknown'
 * so the next ensurePermission() call goes through requestPermissionsAsync
 * and triggers the system popup.
 */
type PermissionResponse = {
  status: string;
  canAskAgain?: boolean;
};

function toPermissionState(response: PermissionResponse | string): PermissionState {
  // Backwards-compat: callers that pass a bare status string fall back to
  // best-effort mapping (no canAskAgain context).
  if (typeof response === 'string') {
    if (response === 'granted') return 'granted';
    if (response === 'denied') return 'denied';
    return 'unknown';
  }
  if (response.status === 'granted') return 'granted';
  if (response.status === 'denied') {
    // Real denial only when the OS won't let us ask again. Otherwise the
    // user simply hasn't seen the popup yet.
    return response.canAskAgain === false ? 'denied' : 'unknown';
  }
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

  // Android 13+ requires a channel before the OS will show the prompt.
  await configureNotificationSurface(Notifications);

  const existing = await Notifications.getPermissionsAsync();
  let state = toPermissionState(existing);
  if (state === 'unknown') {
    const req = await Notifications.requestPermissionsAsync();
    state = toPermissionState(req);
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
  await configureNotificationSurface(Notifications);

  const seconds = Math.max(1, Math.floor((args.fireAt - Date.now()) / 1000));

  return await Notifications.scheduleNotificationAsync({
    content: {
      title: args.taskTitle,
      body: 'Reminder',
      categoryIdentifier: REMINDER_CATEGORY_ID,
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

async function dismissPresentedNotification(
  notificationIdentifier: string | null | undefined
): Promise<void> {
  if (!notificationIdentifier) return;
  const Notifications = await loadModule();
  if (!Notifications) return;
  try {
    await Notifications.dismissNotificationAsync(notificationIdentifier);
  } catch {
    // Best-effort only. Some platforms/OEMs may have already removed it.
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
  try {
    await configureNotificationSurface(Notifications);
  } catch {
    // Best-effort only. If category registration fails we still want the
    // permission/cache logic below to run and reminders can still schedule.
  }
  // We don't need to ensurePermission() here — it's fine to no-op when the
  // user hasn't granted yet. If they later grant, the next save reconciles.
  const status = await Notifications.getPermissionsAsync();
  // Pass the full response, not just `status.status`, so the
  // canAskAgain-aware mapper can correctly identify "first-launch never
  // asked" as 'unknown' rather than 'denied'. Otherwise the boot-time
  // call would poison the cache and the request popup would never fire.
  const permissionState = toPermissionState(status);
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
  await scheduleDebugNotificationAt(Date.now() + 3_000);
  return 'granted';
}

export async function primeNotificationActions(): Promise<void> {
  const Notifications = await loadModule();
  if (!Notifications) return;
  await configureNotificationSurface(Notifications);
}

async function completeTaskFromNotification(taskId: string): Promise<void> {
  const task = await tasksRepo.getTaskById(taskId);
  if (!task || task.status === 'done') return;

  await tasksRepo.completeTask(taskId);
  await cancelForTask(taskId);

  try {
    const spawned = await tasksRepo.spawnNextOccurrence(taskId);
    if (spawned && spawned.dueAt !== null) {
      await scheduleForTask({
        taskId: spawned.id,
        taskTitle: spawned.title,
        taskDueAt: spawned.dueAt,
        taskDueTime: spawned.dueTime,
      });
    }
  } catch {
    // Best-effort only. Completion should still stick even if recurrence
    // spawning fails.
  }
}

async function snoozeTaskFromNotification(args: {
  taskId: string;
  scheduledNotificationId: string;
}): Promise<void> {
  const reminder = await remindersRepo.getActiveReminderByScheduledNotificationId(
    args.scheduledNotificationId
  );
  const fireAt = Date.now() + SNOOZE_MINUTES * 60 * 1000;

  if (reminder) {
    const nextId = await scheduleOne({
      taskId: reminder.taskId,
      taskTitle: reminder.taskTitle,
      fireAt,
    });
    await remindersRepo.updateReminder(reminder.reminderId, {
      scheduledNotificationId: nextId,
    });
    return;
  }

  const task = await tasksRepo.getTaskById(args.taskId);
  if (!task || task.status === 'done') return;
  await scheduleOne({
    taskId: task.id,
    taskTitle: task.title,
    fireAt,
  });
}

export async function handleNotificationResponse(
  response: NotificationResponseLike
): Promise<void> {
  const notificationIdentifier = response.notification.request.identifier;
  const data = response.notification.request.content.data;
  if (isDebugNotificationData(data)) {
    if (response.actionIdentifier === REMINDER_ACTION_SNOOZE) {
      await dismissPresentedNotification(notificationIdentifier);
      await scheduleDebugNotificationAt(Date.now() + SNOOZE_MINUTES * 60 * 1000);
    }
    return;
  }

  const taskId = taskIdFromData(data);
  if (!taskId) return;

  if (response.actionIdentifier === REMINDER_ACTION_DONE) {
    await dismissPresentedNotification(notificationIdentifier);
    await completeTaskFromNotification(taskId);
    return;
  }

  if (response.actionIdentifier === REMINDER_ACTION_SNOOZE) {
    await dismissPresentedNotification(notificationIdentifier);
    await snoozeTaskFromNotification({
      taskId,
      scheduledNotificationId: notificationIdentifier,
    });
  }
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
