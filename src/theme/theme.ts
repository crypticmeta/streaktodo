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
  info: string;
  infoSoft: string;

  // Tactical UI
  scrim: string;       // overlay behind modals
  divider: string;
  link: string;
  focusRing: string;
};

const lightColors: SemanticColors = {
  // "Streak garden": sunny paper, crisp cards, leaf-green actions, and
  // candy-like status tints. It stays calm enough for a daily utility while
  // giving the app a recognizable, playful personality.
  background: '#FFF7E6',
  surface: palette.white,
  surfaceMuted: '#F2EDE4',
  surfaceRaised: palette.white,

  border: '#E5D9C6',
  borderMuted: '#D8C8AF',
  borderStrong: '#756957',

  textPrimary: '#25213A',
  textSecondary: '#514B61',
  textMuted: '#696273',
  textInverse: palette.white,
  textOnAccent: palette.white,
  textOnAccentSoft: '#25213A',

  accent: '#1D6D55',
  accentSoft: '#BDE8D4',
  accentMuted: '#DDF5E9',

  success: '#23734D',
  successSoft: '#D7F3DF',
  warn: '#7A5411',
  warnSoft: '#FFE7A8',
  danger: '#B62F4A',
  dangerSoft: '#FFDCE5',
  info: '#4D55A5',
  infoSoft: '#E2E4FF',

  scrim: 'rgba(37, 33, 58, 0.48)',
  divider: '#E5D9C6',
  link: '#1D6D55',
  focusRing: '#1D6D55',
};

const darkColors: SemanticColors = {
  background: '#18172A',
  surface: '#24223A',
  surfaceMuted: '#2E2B48',
  surfaceRaised: '#34304E',

  border: '#403C5D',
  borderMuted: '#373451',
  borderStrong: '#918AA9',

  textPrimary: '#FFF8E8',
  textSecondary: '#DDD5EC',
  textMuted: '#B9B1C9',
  textInverse: '#18172A',
  textOnAccent: '#10291F',
  textOnAccentSoft: '#FFF8E8',

  accent: '#70D6A9',
  accentSoft: '#214B3E',
  accentMuted: '#2C624F',

  success: '#7BE1A9',
  successSoft: '#203F35',
  warn: '#FFD166',
  warnSoft: '#4D3B19',
  danger: '#FF8FA3',
  dangerSoft: '#512536',
  info: '#AEB7FF',
  infoSoft: '#33365D',

  scrim: 'rgba(0, 0, 0, 0.6)',
  divider: '#403C5D',
  link: '#70D6A9',
  focusRing: '#70D6A9',
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
