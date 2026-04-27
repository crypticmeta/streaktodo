/**
 * @deprecated — Use `useTheme()` from './ThemeProvider' instead.
 *
 * This shim exists so existing screens compile while we migrate them off
 * the flat `colors` object onto the semantic theme. Remove once
 * SignInScreen and NotificationsScreen consume `useTheme()` directly.
 */
import { lightTheme } from './theme';

const c = lightTheme.color;

export const colors = {
  bg: c.background,
  card: c.surface,
  cardBorder: c.border,
  primary: c.accent,
  primarySoft: c.accentSoft,
  secondary: '#675641',
  warn: c.warnSoft,
  muted: c.surfaceMuted,
  mutedBorder: c.borderMuted,
  textPrimary: c.textPrimary,
  textSecondary: c.textSecondary,
  textTertiary: c.textMuted,
  textOnPrimary: c.textOnAccent,
  textOnPrimarySoft: c.textOnAccentSoft,
} as const;
