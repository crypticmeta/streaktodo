/**
 * Analytics wrapper around Mixpanel.
 *
 * - Lazy init: the SDK loads on first call, not on app boot, so the cold-start
 *   path stays cheap.
 * - Best-effort: every method swallows errors. Analytics must never crash the
 *   app or block a user-facing action.
 * - Always-on by default (including __DEV__ builds) so you see your own events
 *   in Mixpanel while iterating. Set EXPO_PUBLIC_MIXPANEL_DISABLE=1 to mute
 *   the SDK locally if a dev session is producing noisy events.
 */

import { Platform } from 'react-native';
import { Mixpanel } from 'mixpanel-react-native';
import { branding } from '../../branding';
import type { AuthUser } from './auth';

const DISABLED = process.env.EXPO_PUBLIC_MIXPANEL_DISABLE === '1';

let instance: Mixpanel | null = null;
let initPromise: Promise<Mixpanel | null> | null = null;

async function getMixpanel(): Promise<Mixpanel | null> {
  if (DISABLED) return null;
  if (instance) return instance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Second arg `trackAutomaticEvents` enables Mixpanel's built-in
      // app-open / session events. We want those — Mixpanel handles them
      // more reliably than we would in JS.
      const mp = new Mixpanel(branding.mixpanelToken, true);
      await mp.init();
      // Honour data-residency override. Mixpanel projects in EU or India
      // need a non-default server URL or events are silently dropped.
      // Set EXPO_PUBLIC_MIXPANEL_REGION to 'eu' or 'in' if the project lives
      // outside US.
      const region = (process.env.EXPO_PUBLIC_MIXPANEL_REGION ?? '').toLowerCase();
      if (region === 'eu') {
        mp.setServerURL('https://api-eu.mixpanel.com');
      } else if (region === 'in') {
        mp.setServerURL('https://api-in.mixpanel.com');
      }
      if (__DEV__) {
        // Surface SDK internals (network, queueing) in Metro so we can see
        // why events would be silently dropped.
        mp.setLoggingEnabled(true);
      }
      console.log(
        '[analytics] mixpanel init ok, token suffix:',
        branding.mixpanelToken.slice(-6)
      );
      instance = mp;
      return mp;
    } catch (err) {
      // Ingest unreachable, token misconfigured, etc. Fall back to no-op.
      console.warn('[analytics] init failed', err);
      return null;
    }
  })();

  return initPromise;
}

export type EventName =
  | 'app_opened'
  | 'onboarding_completed'
  | 'task_created'
  | 'task_edited'
  | 'task_completed'
  | 'task_uncompleted'
  | 'task_deleted'
  | 'category_created'
  | 'category_deleted'
  | 'streak_extended'
  | 'notification_scheduled'
  | 'theme_changed'
  | 'custom_repeat_configured'
  | 'backup_exported'
  | 'backup_imported'
  | 'local_data_reset';

type Primitive = string | number | boolean | null;
type Props = Record<string, Primitive | Primitive[]>;

const TASK_TITLE_MAX = 200;
const TASK_NOTES_MAX = 2_000;
const SUBTASK_TITLE_MAX = 140;
const MAX_SUBTASKS_TRACKED = 10;

function trimTrackedText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function buildTaskTextProps(args: {
  title: string;
  notes?: string | null;
  subtasks?: string[];
}): Props {
  const title = trimTrackedText(args.title, TASK_TITLE_MAX);
  const notes = args.notes ? trimTrackedText(args.notes, TASK_NOTES_MAX) : null;
  const subtasks = (args.subtasks ?? [])
    .map((item) => trimTrackedText(item, SUBTASK_TITLE_MAX))
    .filter((item) => item.length > 0)
    .slice(0, MAX_SUBTASKS_TRACKED);

  return {
    task_title: title,
    task_notes: notes && notes.length > 0 ? notes : null,
    subtask_titles: subtasks,
    subtask_count_tracked: subtasks.length,
  };
}

export async function track(event: EventName, props?: Props): Promise<void> {
  const mp = await getMixpanel();
  if (!mp) {
    if (__DEV__) console.log('[analytics] track skipped (no mp instance):', event);
    return;
  }
  try {
    mp.track(event, props);
    if (__DEV__) {
      console.log('[analytics] track:', event, props ?? '');
      // In dev, push the queue out the door immediately so we don't wait
      // for the SDK's batch timer (default ~60s).
      mp.flush();
    }
  } catch (err) {
    console.warn('[analytics] track failed', event, err);
  }
}

/**
 * Identify the current user and push as much profile data to Mixpanel People
 * as the auth provider gave us. Idempotent; safe to call on every app open.
 */
export async function identify(user: AuthUser): Promise<void> {
  const mp = await getMixpanel();
  if (!mp) return;
  try {
    await mp.identify(user.id);
    const people = mp.getPeople();
    // Mixpanel's reserved $-prefixed keys map directly into the People view.
    // Strip null/undefined so Mixpanel doesn't store them as literal nulls.
    const profile: Record<string, string> = {
      $email: user.email,
      google_id: user.id,
      platform: Platform.OS,
      app_name: branding.appName,
    };
    if (user.name) profile.$name = user.name;
    if (user.givenName) profile.$first_name = user.givenName;
    if (user.familyName) profile.$last_name = user.familyName;
    if (user.photo) profile.$avatar = user.photo;
    people.set(profile);
    // Capture first-seen-at on insert only.
    people.setOnce({ first_seen_at: new Date().toISOString() });
    if (__DEV__) {
      console.log('[analytics] identify ok, distinct_id:', user.id);
      mp.flush();
    }
  } catch (err) {
    console.warn('[analytics] identify failed', err);
  }
}

/**
 * Reset Mixpanel's distinct ID. Call on sign-out so subsequent events from
 * the same device aren't attributed to the previous user.
 */
export async function reset(): Promise<void> {
  const mp = await getMixpanel();
  if (!mp) return;
  try {
    mp.reset();
  } catch (err) {
    console.warn('[analytics] reset failed', err);
  }
}
