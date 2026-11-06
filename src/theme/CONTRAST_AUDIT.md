# Color contrast audit

The light and dark “streak garden” palettes are checked against WCAG 2.1 AA:

- 4.5:1 for normal text
- 3:1 for large text and meaningful non-text UI, such as control borders

The executable regression coverage is in
[`src/theme/__tests__/contrast.test.ts`](./__tests__/contrast.test.ts). It
imports the real theme tokens, so changing a color can fail `npm test` instead
of silently making this document stale.

## Light theme

| Pair | Ratio |
|---|---:|
| textPrimary on background / surface / surfaceMuted | 14.51 / 15.47 / 13.27 |
| textSecondary on background / surface / surfaceMuted | 7.79 / 8.30 / 7.12 |
| textMuted on background / surface / surfaceMuted | 5.48 / 5.84 / 5.01 |
| textOnAccent on accent | 6.23 |
| accent on background / surface / accentSoft | 5.84 / 6.23 / 4.64 |
| success on successSoft | 4.90 |
| warn on warnSoft | 5.56 |
| danger on dangerSoft | 4.76 |
| info on infoSoft | 5.31 |
| borderStrong on surface / surfaceMuted | 5.36 / 4.60 |
| textPrimary on accentSoft | 11.54 |

## Dark theme

| Pair | Ratio |
|---|---:|
| textPrimary on background / surface / surfaceMuted | 16.61 / 14.54 / 12.76 |
| textSecondary on background / surface / surfaceMuted | 12.39 / 10.85 / 9.52 |
| textMuted on background / surface / surfaceMuted | 8.53 / 7.47 / 6.56 |
| textOnAccent on accent | 8.74 |
| accent on background / surface / accentSoft | 9.94 / 8.70 / 5.55 |
| success on successSoft | 7.23 |
| warn on warnSoft | 7.45 |
| danger on dangerSoft | 5.82 |
| info on infoSoft | 6.03 |
| borderStrong on surface / surfaceMuted | 4.70 / 4.12 |
| textPrimary on accentSoft | 9.27 |

The audit covers the fixed semantic pairs rendered by the app. User-selectable
category colors are decorative and are never the only carrier of task state;
labels, icons, and accessibility text provide the same meaning.

[WCAG 1.4.11]: https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html
