/**
 * Privacy-bounded Mixpanel wrapper.
 *
 * Product actions and coarse task shape are tracked; task titles, notes,
 * subtask text, category names, reminder text, and backup contents never are.
 * Tracking is best-effort and can be disabled from Insights.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Mixpanel as MixpanelClient } from 'mixpanel-react-native';
import { branding } from '../../branding';
import type { AuthUser } from './auth';

const ANALYTICS_PREF_KEY = 'analytics_enabled_v1';
const FORCED_DISABLED = process.env.EXPO_PUBLIC_MIXPANEL_DISABLE === '1';

let instance: MixpanelClient | null = null;
let initPromise: Promise<MixpanelClient | null> | null = null;
let enabledCache: boolean | null = null;

export type EventName =
  | 'app_opened'
  | 'onboarding_completed'
  | 'sign_in_completed'
  | 'local_mode_selected'
  | 'sign_out'
  | 'task_created'
  | 'task_edited'
  | 'task_completed'
  | 'task_uncompleted'
  | 'task_deleted'
  | 'category_created'
  | 'category_deleted'
  | 'notification_scheduled'
  | 'theme_changed'
  | 'custom_repeat_configured'
  | 'backup_exported'
  | 'backup_imported'
  | 'local_data_reset'
  | 'analytics_preference_changed';

type Primitive = string | number | boolean | null;
export type EventProps = Record<string, Primitive | Primitive[]>;

export async function getAnalyticsEnabled(): Promise<boolean> {
  if (FORCED_DISABLED) return false;
  if (enabledCache !== null) return enabledCache;
  try {
    const stored = await SecureStore.getItemAsync(ANALYTICS_PREF_KEY);
    enabledCache = stored === null ? true : stored === 'true';
  } catch {
    enabledCache = true;
  }
  return enabledCache;
}

function serverURL(): string | undefined {
  const region = (process.env.EXPO_PUBLIC_MIXPANEL_REGION ?? '').toLowerCase();
  if (region === 'eu') return 'https://api-eu.mixpanel.com';
  if (region === 'in') return 'https://api-in.mixpanel.com';
  return undefined;
}

async function getMixpanel(): Promise<MixpanelClient | null> {
  if (!(await getAnalyticsEnabled())) return null;
  if (instance) return instance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Automatic capture stays off so the event schema remains explicit and
      // the preference can be honored before anything is queued. Loading the
      // SDK here also keeps opted-out sessions off the startup path.
      const { Mixpanel } = await import('mixpanel-react-native');
      const mixpanel = new Mixpanel(branding.mixpanelToken, false);
      await mixpanel.init(
        false,
        { app_name: branding.appName, platform: Platform.OS },
        serverURL()
      );
      mixpanel.setUseIpAddressForGeolocation(false);
      mixpanel.setFlushOnBackground(true);
      if (__DEV__) mixpanel.setLoggingEnabled(true);
      instance = mixpanel;
      return mixpanel;
    } catch (error) {
      if (__DEV__) console.warn('[analytics] Mixpanel initialization failed', error);
      initPromise = null;
      return null;
    }
  })();
  return initPromise;
}

export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
  if (FORCED_DISABLED && enabled) {
    throw new Error('Analytics is disabled for this build.');
  }
  await SecureStore.setItemAsync(ANALYTICS_PREF_KEY, enabled ? 'true' : 'false');
  enabledCache = enabled;
  if (enabled) {
    const mixpanel = await getMixpanel();
    mixpanel?.optInTracking();
    mixpanel?.track('analytics_preference_changed', { enabled: true });
    mixpanel?.flush();
  } else if (instance) {
    // Opting out should not itself transmit another analytics event.
    instance.optOutTracking();
  }
}

export function buildTaskShapeProps(args: {
  hasDueDate: boolean;
  hasTime: boolean;
  hasNotes: boolean;
  subtaskCount: number;
  hasCategory: boolean;
  hasReminder: boolean;
  hasRepeat: boolean;
}): EventProps {
  return {
    has_due_date: args.hasDueDate,
    has_time: args.hasTime,
    has_notes: args.hasNotes,
    subtask_count: Math.max(0, Math.min(25, Math.floor(args.subtaskCount))),
    has_category: args.hasCategory,
    has_reminder: args.hasReminder,
    has_repeat: args.hasRepeat,
  };
}

export async function track(event: EventName, props?: EventProps): Promise<void> {
  const mixpanel = await getMixpanel();
  if (!mixpanel) return;
  try {
    mixpanel.track(event, props);
    if (__DEV__) {
      console.log('[analytics] track:', event);
      mixpanel.flush();
    }
  } catch (error) {
    if (__DEV__) console.warn('[analytics] track failed:', event, error);
  }
}

export async function identify(user: AuthUser): Promise<void> {
  const mixpanel = await getMixpanel();
  if (!mixpanel) return;
  try {
    await mixpanel.identify(user.id);
    const profile: Record<string, string> = {
      $email: user.email,
      google_id: user.id,
      platform: Platform.OS,
      app_name: branding.appName,
    };
    if (user.name) profile.$name = user.name;
    mixpanel.getPeople().set(profile);
    mixpanel.getPeople().setOnce({ first_seen_at: new Date().toISOString() });
  } catch (error) {
    if (__DEV__) console.warn('[analytics] identify failed', error);
  }
}

export async function reset(): Promise<void> {
  try {
    instance?.reset();
  } catch (error) {
    if (__DEV__) console.warn('[analytics] reset failed', error);
  }
}

export function flush(): void {
  try {
    instance?.flush();
  } catch {
    // Best effort only.
  }
}
