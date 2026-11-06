import { describe, expect, it } from 'vitest';
import { darkTheme, lightTheme, type Theme } from '../theme';

function channelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = value.match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16));
  if (!channels || channels.length !== 3 || channels.some(Number.isNaN)) {
    throw new Error(`Expected a six-digit hex color, received ${hex}`);
  }
  return (
    0.2126 * channelToLinear(channels[0])
    + 0.7152 * channelToLinear(channels[1])
    + 0.0722 * channelToLinear(channels[2])
  );
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

const textPairs: Array<[keyof Theme['color'], keyof Theme['color']]> = [
  ['textPrimary', 'background'],
  ['textPrimary', 'surface'],
  ['textPrimary', 'surfaceMuted'],
  ['textSecondary', 'background'],
  ['textSecondary', 'surface'],
  ['textSecondary', 'surfaceMuted'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['textMuted', 'surfaceMuted'],
  ['textOnAccent', 'accent'],
  ['accent', 'background'],
  ['accent', 'surface'],
  ['accent', 'accentSoft'],
  ['success', 'successSoft'],
  ['warn', 'warnSoft'],
  ['danger', 'dangerSoft'],
  ['info', 'infoSoft'],
];

const uiPairs: Array<[keyof Theme['color'], keyof Theme['color']]> = [
  ['borderStrong', 'surface'],
  ['borderStrong', 'surfaceMuted'],
  ['textPrimary', 'accentSoft'],
];

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
] as const)('%s theme contrast', (_name, theme) => {
  it.each(textPairs)('%s on %s clears 4.5:1', (foreground, background) => {
    expect(contrast(theme.color[foreground], theme.color[background])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(uiPairs)('%s on %s clears 3:1', (foreground, background) => {
    expect(contrast(theme.color[foreground], theme.color[background])).toBeGreaterThanOrEqual(3);
  });
});
