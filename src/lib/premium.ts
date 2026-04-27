/**
 * Premium feature matrix.
 *
 * Stance for V0: every feature is FREE. The matrix exists so we can flip a
 * single flag later (or read entitlements from the user's account) without
 * touching every call site. UI labels for premium-flagged options should call
 * `isPremiumFeatureEnabled(key)` to decide whether to render a 👑 marker or
 * gate behavior.
 *
 * To gate something later:
 *   1. Set `featureFlags[<key>]` to a function that returns false unless the
 *      user has an entitlement.
 *   2. Wire the entitlement source (RevenueCat / our own server / etc.) into
 *      this module.
 */

export type PremiumFeatureKey =
  | 'reminder_alarm_type'
  | 'reminder_silent_type'
  | 'reminder_screenlock'
  | 'repeat_custom'
  | 'attachments'
  | 'templates'
  | 'widgets'
  | 'cloud_sync';

// All free for now. Each entry's comment captures why it's premium-flagged.
const featureFlags: Record<PremiumFeatureKey, () => boolean> = {
  reminder_alarm_type: () => true,    // 👑 alarm-style reminders (loud, full-screen)
  reminder_silent_type: () => true,   // 👑 silent reminders (no sound, just badge)
  reminder_screenlock: () => true,    // 👑 show task on lock screen
  repeat_custom: () => true,          // 👑 custom RRULE-style recurrence
  attachments: () => true,            // 👑 file attachments per task
  templates: () => true,              // 👑 reusable task templates
  widgets: () => true,                // 👑 home-screen widgets
  cloud_sync: () => true,             // 👑 multi-device sync
};

export function isPremiumFeatureEnabled(key: PremiumFeatureKey): boolean {
  return featureFlags[key]();
}

/** Stable list of features that are *flagged* as premium, even if currently free. */
export const PREMIUM_FEATURE_KEYS: ReadonlyArray<PremiumFeatureKey> = Object.keys(
  featureFlags
) as PremiumFeatureKey[];

/** UI helper: should we show a crown / "Pro" badge next to this option? */
export function shouldShowPremiumBadge(_key: PremiumFeatureKey): boolean {
  // Always show the crown so users learn which features will be gated later.
  // Flip to a feature-flag-aware check once gating goes live.
  return true;
}
