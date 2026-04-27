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

  textPrimary: '#1F2328',
  textSecondary: '#4b443d',
  textMuted: '#7a6e62',
  textInverse: palette.white,
  textOnAccent: '#F4EFE6',
  textOnAccentSoft: '#dcccb7',

  accent: '#1F2328',
  accentSoft: '#D2B48C',
  accentMuted: '#EAD7B7',

  success: palette.evergreen[500],
  successSoft: palette.evergreen[100],
  warn: palette.amber[500],
  warnSoft: palette.amber[200],
  danger: palette.crimson[500],
  dangerSoft: palette.crimson[100],

  scrim: 'rgba(31, 35, 40, 0.45)',
  divider: palette.cream[400],
  link: '#1F2328',
  focusRing: '#D2B48C',
};

const darkColors: SemanticColors = {
  background: '#1F2328',
  surface: '#2A2F35',
  surfaceMuted: '#343A42',
  surfaceRaised: '#31363D',

  border: '#444b54',
  borderMuted: '#383f47',
  borderStrong: '#59626d',

  textPrimary: '#F4EFE6',
  textSecondary: '#d5cdc1',
  textMuted: '#b1a89b',
  textInverse: '#1F2328',
  textOnAccent: '#1F2328',
  textOnAccentSoft: '#4d4338',

  accent: '#D2B48C',
  accentSoft: '#4b3f33',
  accentMuted: '#6e5b46',

  success: palette.evergreen[300],
  successSoft: palette.evergreen[700],
  warn: palette.amber[300],
  warnSoft: palette.amber[700],
  danger: palette.crimson[300],
  dangerSoft: palette.crimson[700],

  scrim: 'rgba(0, 0, 0, 0.6)',
  divider: '#444b54',
  link: '#D2B48C',
  focusRing: '#D2B48C',
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
