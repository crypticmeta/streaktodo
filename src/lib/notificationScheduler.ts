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

import { NativeModules, Platform } from 'react-native';
import { getDb, remindersRepo, tasksRepo } from '../db';
import { emit } from '../db/events';
import { computeReminderFireAt } from './reminderTime';
export { computeReminderFireAt } from './reminderTime';

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

export type PermissionState = 'unknown' | 'granted' | 'denied';
export type ExactAlarmState = 'granted' | 'denied' | 'unavailable';
let permissionCache: PermissionState = 'unknown';
const REMINDER_CATEGORY_ID = 'REMINDER';
const REMINDER_ACTION_DONE = 'DONE';
const REMINDER_ACTION_SNOOZE = 'SNOOZE_10M';
const SNOOZE_MINUTES = 10;
// Dev-only reminder smoke-test schedule. Each value is the offset in
// minutes from "the next whole minute + 1 minute" (i.e. the batch's base
// fire time). Tighter spacing surfaces drift faster; the 8-minute
// horizon stays inside one Doze maintenance window so we measure the
// best-case path rather than worst-case.
const DEBUG_BATCH_OFFSETS_MINUTES = [2, 4, 6, 8] as const;
let categorySetupPromise: Promise<void> | null = null;
type ExactAlarmModuleShape = {
  canScheduleExactAlarms(): Promise<boolean>;
  openExactAlarmSettings(): Promise<boolean>;
};

function getExactAlarmModule(): ExactAlarmModuleShape | null {
  const maybeModule = NativeModules.ExactAlarmModule as ExactAlarmModuleShape | undefined;
  return maybeModule ?? null;
}

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

function numberFromData(data: unknown, key: string): number | null {
  if (!isRecord(data)) return null;
  const value = data[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dueTimeMinutes(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

function nextWholeMinutePlusOneMinute(nowTs: number = Date.now()): number {
  return Math.ceil(nowTs / 60_000) * 60_000 + 60_000;
}

export function logNotificationTiming(data: unknown, source: string): void {
  const expectedFireAt = numberFromData(data, 'expectedFireAt');
  if (expectedFireAt === null) return;
  const scheduledAt = numberFromData(data, 'scheduledAt');
  const taskId = taskIdFromData(data);
  console.log(
    '[notif]',
    source,
    JSON.stringify({
      taskId,
      scheduledAt,
      expectedFireAt,
      observedAt: Date.now(),
      delayMs: Date.now() - expectedFireAt,
    })
  );
}

export async function getExactAlarmState(): Promise<ExactAlarmState> {
  if (Platform.OS !== 'android') return 'granted';
  const module = getExactAlarmModule();
  if (!module) return 'unavailable';
  try {
    return (await module.canScheduleExactAlarms()) ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}

export async function openExactAlarmSettings(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const module = getExactAlarmModule();
  if (!module) return false;
  try {
    return await module.openExactAlarmSettings();
  } catch {
    return false;
  }
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
  const scheduledAt = Date.now();

  // Mirror the production scheduleOne path so the dev smoke test exercises
  // the same DATE / exact-alarm route that real reminders take.
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Streak Todo · debug',
      body: 'Action-button smoke test. Try Done or Snooze 10m.',
      categoryIdentifier: REMINDER_CATEGORY_ID,
      data: { debug: true, expectedFireAt: fireAt, scheduledAt },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
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
    return 'unknown';
  }

  try {
    // Android 13+ requires a channel before the OS will show the prompt.
    await configureNotificationSurface(Notifications);

    const existing = await Notifications.getPermissionsAsync();
    let state = toPermissionState(existing);
    if (state === 'unknown') {
      const req = await Notifications.requestPermissionsAsync();
      // A response to an explicit prompt is definitive even when Android says
      // it may ask again later. The canAskAgain workaround only applies to the
      // pre-prompt getPermissionsAsync response.
      state = req.status === 'granted'
        ? 'granted'
        : req.status === 'denied'
          ? 'denied'
          : 'unknown';
    }
    permissionCache = state;
    return permissionCache;
  } catch {
    // Native services can be temporarily unavailable. Keep this retryable
    // and let the caller display a scheduling-specific error.
    permissionCache = 'unknown';
    return 'unknown';
  }
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
  const scheduledAt = Date.now();

  // DATE trigger fires at a specific wall-clock time. On Android with
  // SCHEDULE_EXACT_ALARM granted (declared in app.config.ts → android.
  // permissions), expo-notifications routes through
  // AlarmManager.setExactAndAllowWhileIdle, which bypasses Doze batching
  // and delivers within seconds of the target. If the user revokes the
  // exact-alarm permission in system settings, Android automatically
  // falls back to inexact delivery (delayed by Doze, but still fires).
  // Either way, the trigger is more accurate than TIME_INTERVAL, which
  // expressed only the gap and was always converted to inexact under
  // the hood.
  return await Notifications.scheduleNotificationAsync({
    content: {
      title: args.taskTitle,
      body: 'Reminder',
      categoryIdentifier: REMINDER_CATEGORY_ID,
      data: {
        taskId: args.taskId,
        expectedFireAt: args.fireAt,
        scheduledAt,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: args.fireAt,
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
    await remindersRepo.updateReminder(r.id, {
      scheduledNotificationId: null,
      scheduleState: 'pending',
      scheduleError: null,
      scheduledFor: null,
    });
  }
}

export type ScheduleForTaskResult = {
  state: 'scheduled' | 'permission_denied' | 'invalid' | 'error' | 'no_reminders';
  scheduledCount: number;
  exactAlarm: ExactAlarmState;
  message: string | null;
};

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
}): Promise<ScheduleForTaskResult> {
  const reminders = await remindersRepo.listRemindersByTask(args.taskId);
  const exactAlarm = await getExactAlarmState();
  if (reminders.length === 0) {
    return { state: 'no_reminders', scheduledCount: 0, exactAlarm, message: null };
  }
  const permission = await ensurePermission();
  if (permission !== 'granted') {
    const denied = permission === 'denied';
    await Promise.all(reminders.map((reminder) => remindersRepo.updateReminder(reminder.id, {
      scheduledNotificationId: null,
      scheduleState: denied ? 'permission_denied' : 'error',
      scheduleError: denied
        ? 'Notifications are disabled in system settings.'
        : 'Notification permission could not be checked.',
      scheduledFor: null,
    })));
    emit('tasks-changed');
    return {
      state: denied ? 'permission_denied' : 'error',
      scheduledCount: 0,
      exactAlarm,
      message: denied
        ? 'Notifications are off. Allow them in system settings to receive reminders.'
        : 'The task was saved, but notification permission could not be checked. Try again after reopening the app.',
    };
  }

  let scheduledCount = 0;
  let invalidCount = 0;
  let failedCount = 0;
  for (const r of reminders) {
    await cancelOne(r.scheduledNotificationId);
    const fireAt = computeReminderFireAt({
      dueAt: args.taskDueAt,
      dueTime: args.taskDueTime,
      leadMinutes: r.leadMinutes,
    });
    if (fireAt === null) {
      invalidCount += 1;
      await remindersRepo.updateReminder(r.id, {
        scheduledNotificationId: null,
        scheduleState: 'invalid',
        scheduleError: 'This reminder time has already passed.',
        scheduledFor: null,
      });
      continue;
    }
    try {
      const id = await scheduleOne({
        taskId: args.taskId,
        taskTitle: args.taskTitle,
        fireAt,
      });
      if (!id) throw new Error('The operating system did not schedule the reminder.');
      scheduledCount += 1;
      await remindersRepo.updateReminder(r.id, {
        scheduledNotificationId: id,
        scheduleState: 'scheduled',
        scheduleError: null,
        scheduledFor: fireAt,
      });
    } catch (error) {
      failedCount += 1;
      await remindersRepo.updateReminder(r.id, {
        scheduledNotificationId: null,
        scheduleState: 'error',
        scheduleError: error instanceof Error ? error.message : 'Reminder scheduling failed.',
        scheduledFor: null,
      });
    }
  }
  if (failedCount > 0) {
    emit('tasks-changed');
    return {
      state: 'error', scheduledCount, exactAlarm,
      message: 'The task was saved, but at least one reminder could not be scheduled.',
    };
  }
  if (invalidCount > 0 && scheduledCount === 0) {
    emit('tasks-changed');
    return {
      state: 'invalid', scheduledCount: 0, exactAlarm,
      message: 'The reminder time has already passed. Choose a future time.',
    };
  }
  emit('tasks-changed');
  return {
    state: 'scheduled',
    scheduledCount,
    exactAlarm,
    message: exactAlarm === 'denied'
      ? 'Reminder scheduled. Android may deliver it late until exact alarms are allowed.'
      : null,
  };
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
    if (permissionState === 'denied') {
      const rows = await remindersRepo.listAllActiveRemindersWithTask();
      await Promise.all(rows.map((row) => remindersRepo.updateReminder(row.reminderId, {
        scheduleState: 'permission_denied',
        scheduleError: 'Notifications are disabled in system settings.',
      })));
      emit('tasks-changed');
    }
    return;
  }
  permissionCache = permissionState;

  const rows = await remindersRepo.listAllActiveRemindersWithTask();
  const scheduledRequests = await Notifications.getAllScheduledNotificationsAsync();
  const liveIds = new Set(scheduledRequests.map((request) => request.identifier));
  for (const row of rows) {
    const fireAt = computeReminderFireAt({
      dueAt: row.taskDueAt,
      dueTime: row.taskDueTime,
      leadMinutes: row.leadMinutes,
    });

    if (fireAt === null) {
      // Past due or undated — clear stale ids and health regardless of the
      // reminder's previous state (including permission-denied rows).
      if (row.scheduledNotificationId) await cancelOne(row.scheduledNotificationId);
      if (
        row.scheduledNotificationId ||
        row.scheduleState !== 'invalid' ||
        row.scheduledFor !== null
      ) {
        await remindersRepo.updateReminder(row.reminderId, {
          scheduledNotificationId: null,
          scheduleState: 'invalid',
          scheduleError: 'This reminder time has already passed.',
          scheduledFor: null,
        });
      }
      continue;
    }

    if (
      row.scheduledNotificationId &&
      liveIds.has(row.scheduledNotificationId) &&
      row.scheduledFor === fireAt
    ) {
      continue;
    }

    // Re-arm only missing or changed requests.
    await cancelOne(row.scheduledNotificationId);
    try {
      const id = await scheduleOne({
        taskId: row.taskId,
        taskTitle: row.taskTitle,
        fireAt,
      });
      await remindersRepo.updateReminder(row.reminderId, {
        scheduledNotificationId: id,
        scheduleState: id ? 'scheduled' : 'error',
        scheduleError: id ? null : 'The operating system did not schedule the reminder.',
        scheduledFor: id ? fireAt : null,
      });
    } catch (error) {
      await remindersRepo.updateReminder(row.reminderId, {
        scheduledNotificationId: null,
        scheduleState: 'error',
        scheduleError: error instanceof Error ? error.message : 'Reminder scheduling failed.',
        scheduledFor: null,
      });
    }
  }
  if (rows.length > 0) emit('tasks-changed');
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

export async function createDebugReminderBatch(): Promise<{
  permission: PermissionState;
  exactAlarm: ExactAlarmState;
  reminders: Array<{ title: string; fireAt: number }>;
}> {
  const perm = await ensurePermission();
  if (perm !== 'granted') {
    return { permission: perm, exactAlarm: 'unavailable', reminders: [] };
  }
  const exactAlarm = await getExactAlarmState();
  if (exactAlarm === 'denied') {
    return { permission: 'granted', exactAlarm, reminders: [] };
  }

  const baseFireAt = nextWholeMinutePlusOneMinute();
  const reminders: Array<{ title: string; fireAt: number }> = [];

  for (const offsetMinutes of DEBUG_BATCH_OFFSETS_MINUTES) {
    const fireAt = baseFireAt + offsetMinutes * 60_000;
    const label = new Date(fireAt).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
    const title = `Debug reminder ${label}`;
    const task = await tasksRepo.createTaskFull({
      task: {
        title,
        notes: `Dev reminder batch target ${label}`,
        dueAt: startOfLocalDay(fireAt),
        dueTime: dueTimeMinutes(fireAt),
      },
      subtaskTitles: [],
      reminders: [{ leadMinutes: 0, type: 'notification' }],
      repeatRule: null,
    });
    await scheduleForTask({
      taskId: task.id,
      taskTitle: task.title,
      taskDueAt: task.dueAt,
      taskDueTime: task.dueTime,
    });
    reminders.push({ title: task.title, fireAt });
  }

  return { permission: 'granted', exactAlarm, reminders };
}

export async function primeNotificationActions(): Promise<void> {
  const Notifications = await loadModule();
  if (!Notifications) return;
  await configureNotificationSurface(Notifications);
}

async function completeTaskFromNotification(taskId: string): Promise<void> {
  const task = await tasksRepo.getTaskById(taskId);
  if (!task || task.status === 'done') return;

  const result = await tasksRepo.completeTaskAndSpawnNext(taskId);
  await cancelForTask(taskId).catch(() => {});

  try {
    const spawned = result.spawned;
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
      scheduleState: nextId ? 'scheduled' : 'error',
      scheduleError: nextId ? null : 'The operating system did not schedule the snooze.',
      scheduledFor: nextId ? fireAt : null,
    });
    emit('tasks-changed');
    return;
  }

  const task = await tasksRepo.getTaskById(args.taskId);
  if (!task || task.status === 'done') return;
  const reminders = await remindersRepo.listRemindersByTask(task.id);
  const fallbackReminder = reminders[0];
  if (!fallbackReminder) return;
  const nextId = await scheduleOne({
    taskId: task.id,
    taskTitle: task.title,
    fireAt,
  });
  await remindersRepo.updateReminder(fallbackReminder.id, {
    scheduledNotificationId: nextId,
    scheduleState: nextId ? 'scheduled' : 'error',
    scheduleError: nextId ? null : 'The operating system did not schedule the snooze.',
    scheduledFor: nextId ? fireAt : null,
  });
  emit('tasks-changed');
}

export async function handleNotificationResponse(
  response: NotificationResponseLike
): Promise<{ openTaskId: string } | null> {
  const notificationIdentifier = response.notification.request.identifier;
  const data = response.notification.request.content.data;
  logNotificationTiming(data, `response:${response.actionIdentifier}`);
  if (isDebugNotificationData(data)) {
    if (response.actionIdentifier === REMINDER_ACTION_SNOOZE) {
      await dismissPresentedNotification(notificationIdentifier);
      await scheduleDebugNotificationAt(Date.now() + SNOOZE_MINUTES * 60 * 1000);
    }
    return null;
  }

  const taskId = taskIdFromData(data);
  if (!taskId) return null;

  if (response.actionIdentifier === REMINDER_ACTION_DONE) {
    await dismissPresentedNotification(notificationIdentifier);
    await completeTaskFromNotification(taskId);
    return null;
  }

  if (response.actionIdentifier === REMINDER_ACTION_SNOOZE) {
    await dismissPresentedNotification(notificationIdentifier);
    await snoozeTaskFromNotification({
      taskId,
      scheduledNotificationId: notificationIdentifier,
    });
    return null;
  }
  return { openTaskId: taskId };
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
        SET scheduled_notification_id = NULL,
            scheduled_for = NULL,
            schedule_state = 'pending',
            schedule_error = NULL
      WHERE deleted_at IS NULL`
  );
}
