/**
 * RAW tokens — never reference these directly from screens.
 * These are the primitive values (palette steps, scale rungs, font sizes).
 * Screens consume the SEMANTIC tokens in `theme.ts`, which compose these.
 *
 * To add a new color step or scale rung, edit here.
 * To change what a semantic name maps to, edit `theme.ts`.
 */

// ─── Palette ────────────────────────────────────────────────────────────

// Warm cream base — the existing app aesthetic.
const cream = {
  50: '#fffaf2',
  100: '#f8f3e8',
  200: '#f4efe6',
  300: '#f3eee7',
  400: '#eadfcd',
  500: '#e1d8cc',
  600: '#c8bba8',
  700: '#8a6a43',
  800: '#675641',
  900: '#1f1914',
} as const;

// Deep evergreen accent (primary brand).
const evergreen = {
  50: '#e6f0ec',
  100: '#dcefe1',
  200: '#b6d6c4',
  300: '#7fb59a',
  400: '#3f7e69',
  500: '#1e3a34',
  600: '#172d29',
  700: '#0f201d',
  800: '#0a1614',
  900: '#050b0a',
} as const;

// Warm amber for warnings and pending states.
const amber = {
  50: '#fdf6e6',
  100: '#f8eddc',
  200: '#f3dfbf',
  300: '#ead7b7',
  400: '#d9b178',
  500: '#b58a3d',
  600: '#8a6526',
  700: '#5e4319',
  800: '#3a2a10',
  900: '#1f1607',
} as const;

// Crimson for destructive / overdue.
const crimson = {
  50: '#fdecec',
  100: '#fbd5d5',
  200: '#f3a8a8',
  300: '#e87575',
  400: '#d44a4a',
  500: '#b62c2c',
  600: '#8a1d1d',
  700: '#5e1212',
  800: '#3a0a0a',
  900: '#1c0404',
} as const;

// Neutral grays for dark mode and pure surfaces.
const slate = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#080d1a',
} as const;

const white = '#ffffff';
const black = '#000000';

export const palette = {
  cream,
  evergreen,
  amber,
  crimson,
  slate,
  white,
  black,
} as const;

// ─── Spacing scale ──────────────────────────────────────────────────────
// 4px base unit. Use semantic names everywhere instead of raw numbers.
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
  '6xl': 72,
} as const;

// ─── Border radius ──────────────────────────────────────────────────────
export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 22,
  '3xl': 28,
  pill: 999,
} as const;

// ─── Type scale ─────────────────────────────────────────────────────────
// Sizes paired with sensible line-height defaults.
export const fontSize = {
  xs: 11,
  sm: 13,
  base: 14,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 34,
  '5xl': 42,
} as const;

export const lineHeight = {
  tight: 1.2,
  snug: 1.35,
  normal: 1.5,
  relaxed: 1.65,
} as const;

// React Native does not have a generic font-weight string union, so we keep
// these as the platform-accepted strings.
export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const;

// Letter spacing.
export const tracking = {
  tight: -0.4,
  normal: 0,
  wide: 0.4,
  wider: 1.2,
} as const;

// ─── Elevation (shadow presets) ─────────────────────────────────────────
// Mirror the iOS shadow* + Android elevation pair so consumers don't have
// to hand-roll both for every surface.
export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  sm: {
    shadowColor: '#1f1914',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  md: {
    shadowColor: '#1f1914',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  lg: {
    shadowColor: '#6f4e37',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
} as const;

// ─── Motion ─────────────────────────────────────────────────────────────
export const duration = {
  instant: 0,
  fast: 120,
  normal: 200,
  slow: 320,
} as const;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
export type FontSizeToken = keyof typeof fontSize;
export type FontWeightToken = keyof typeof fontWeight;
export type ElevationToken = keyof typeof elevation;
