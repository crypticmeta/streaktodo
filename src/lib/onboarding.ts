/**
 * Tracks whether the user has completed first-launch onboarding.
 *
 * Stored in expo-secure-store (already installed for the Google ID token).
 * The key carries a version suffix so we can re-trigger onboarding for
 * existing users if we ship a meaningfully different flow later — bump
 * the suffix from 'v1' → 'v2' and the next launch shows the new tour.
 */

import * as SecureStore from 'expo-secure-store';

const KEY = 'onboarding_completed_v1';

export async function getOnboardingCompleted(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(KEY);
    return v === 'true';
  } catch {
    // SecureStore can fail in odd environments (e.g. emulator without
    // keystore). Treat as "not completed" — onboarding is cheap to re-show.
    return false;
  }
}

export async function setOnboardingCompleted(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, 'true');
  } catch {
    // Best-effort. If it fails the user sees onboarding again next launch,
    // which is annoying but not broken.
  }
}

/** Test helper — not exposed beyond dev usage. */
export async function _resetOnboardingForTesting(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
}
