import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { darkTheme, lightTheme, type Theme } from './theme';

export type ColorSchemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme_preference_v1';

function isPreference(v: unknown): v is ColorSchemePreference {
  return v === 'system' || v === 'light' || v === 'dark';
}

type ThemeContextValue = {
  theme: Theme;
  preference: ColorSchemePreference;
  setPreference: (next: ColorSchemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialPreference = 'system',
}: {
  children: ReactNode;
  initialPreference?: ColorSchemePreference;
}) {
  const [preference, setPreferenceState] = useState<ColorSchemePreference>(initialPreference);
  const systemScheme = useColorScheme();

  // Hydrate from SecureStore on mount. The default preference renders for one
  // frame before this resolves — acceptable: the theme tokens are close enough
  // that a brief flash isn't jarring, and the hydration is fast.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!cancelled && isPreference(stored)) setPreferenceState(stored);
      } catch {
        // Ignore — fall back to the in-memory default.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ColorSchemePreference) => {
    setPreferenceState(next);
    // Best-effort persist; if SecureStore is unavailable the user just loses
    // the preference on next launch.
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const resolvedScheme =
      preference === 'system' ? (systemScheme ?? 'light') : preference;
    const theme = resolvedScheme === 'dark' ? darkTheme : lightTheme;
    return { theme, preference, setPreference };
  }, [preference, systemScheme, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx.theme;
}

export function useThemePreference(): {
  preference: ColorSchemePreference;
  setPreference: (next: ColorSchemePreference) => void;
} {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemePreference must be used inside ThemeProvider');
  return { preference: ctx.preference, setPreference: ctx.setPreference };
}
