/**
 * Tracks whether the user has completed first-launch onboarding.
 *
 * Stored in expo-secure-store (already installed for the Google ID token).
 * The key carries a version suffix so we can re-trigger onboarding for
 * existing users if we ship a meaningfully different flow later — bump
 * the suffix from 'v1' → 'v2' and the next launch shows the new tour.
 */

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
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

async function writeOnboardingCompleted(): Promise<void> {
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

export type OnboardingState = 'loading' | 'pending' | 'completed';

type Ctx = {
  state: OnboardingState;
  /** Persist the flag and flip the in-memory state in one shot. */
  markCompleted: () => Promise<void>;
};

const OnboardingContext = createContext<Ctx | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const done = await getOnboardingCompleted();
      if (!cancelled) setState(done ? 'completed' : 'pending');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markCompleted = async () => {
    // Flip state first so AppGate sees 'completed' on the very next render —
    // otherwise the router would replace back to /onboarding before the
    // SecureStore write resolves.
    setState('completed');
    await writeOnboardingCompleted();
  };

  return createElement(OnboardingContext.Provider, { value: { state, markCompleted } }, children);
}

export function useOnboarding(): Ctx {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside <OnboardingProvider>.');
  return ctx;
}
