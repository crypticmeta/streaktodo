/**
 * SEMANTIC tokens — what screens import.
 *
 * Each property describes a *role*, not a value. To re-skin the app:
 *   1. Edit the mappings below (or add a new theme like `oledTheme`).
 *   2. Components don't change.
 *
 * Don't reference `palette.*` from screens. Reference `theme.color.*`.
 */

import {
  palette,
  spacing,
  radius,
  fontSize,
  lineHeight,
  fontWeight,
  tracking,
  elevation,
  duration,
} from './tokens';

type SemanticColors = {
  // Surfaces
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceRaised: string;

  // Borders
  border: string;
  borderMuted: string;
  borderStrong: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  textOnAccent: string;
  textOnAccentSoft: string;

  // Brand accent (primary action)
  accent: string;
  accentSoft: string;
  accentMuted: string;

  // Status
  success: string;
  successSoft: string;
  warn: string;
  warnSoft: string;
  danger: string;
  dangerSoft: string;

  // Tactical UI
  scrim: string;       // overlay behind modals
  divider: string;
  link: string;
  focusRing: string;
};

const lightColors: SemanticColors = {
  background: palette.cream[200],
  surface: palette.cream[50],
  surfaceMuted: palette.cream[300],
  surfaceRaised: palette.white,

  border: palette.cream[400],
  borderMuted: palette.cream[500],
  borderStrong: palette.cream[600],

  textPrimary: palette.cream[900],
  textSecondary: palette.cream[800],
  textMuted: palette.cream[700],
  textInverse: palette.white,
  textOnAccent: palette.white,
  textOnAccentSoft: '#e6eee9',

  accent: palette.evergreen[500],
  accentSoft: palette.evergreen[100],
  accentMuted: palette.evergreen[200],

  success: palette.evergreen[500],
  successSoft: palette.evergreen[100],
  warn: palette.amber[500],
  warnSoft: palette.amber[200],
  danger: palette.crimson[500],
  dangerSoft: palette.crimson[100],

  scrim: 'rgba(15, 32, 29, 0.45)',
  divider: palette.cream[400],
  link: palette.evergreen[500],
  focusRing: palette.evergreen[300],
};

const darkColors: SemanticColors = {
  background: palette.slate[950],
  surface: palette.slate[900],
  surfaceMuted: palette.slate[800],
  surfaceRaised: palette.slate[800],

  border: palette.slate[700],
  borderMuted: palette.slate[800],
  borderStrong: palette.slate[600],

  textPrimary: palette.slate[50],
  textSecondary: palette.slate[300],
  textMuted: palette.slate[400],
  textInverse: palette.slate[900],
  textOnAccent: palette.white,
  textOnAccentSoft: palette.evergreen[100],

  accent: palette.evergreen[300],
  accentSoft: palette.evergreen[700],
  accentMuted: palette.evergreen[600],

  success: palette.evergreen[300],
  successSoft: palette.evergreen[700],
  warn: palette.amber[300],
  warnSoft: palette.amber[700],
  danger: palette.crimson[300],
  dangerSoft: palette.crimson[700],

  scrim: 'rgba(0, 0, 0, 0.6)',
  divider: palette.slate[700],
  link: palette.evergreen[300],
  focusRing: palette.evergreen[400],
};

// Static, non-color tokens are shared across schemes.
const staticTokens = {
  spacing,
  radius,
  fontSize,
  lineHeight,
  fontWeight,
  tracking,
  elevation,
  duration,
} as const;

export type Theme = {
  scheme: 'light' | 'dark';
  color: SemanticColors;
} & typeof staticTokens;

export const lightTheme: Theme = {
  scheme: 'light',
  color: lightColors,
  ...staticTokens,
};

export const darkTheme: Theme = {
  scheme: 'dark',
  color: darkColors,
  ...staticTokens,
};
