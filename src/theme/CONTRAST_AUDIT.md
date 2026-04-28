# Color contrast audit

WCAG 2.1 AA targets (the bar this app is held to):

- **4.5:1** for body text < 18pt (or < 14pt bold)
- **3:1** for large text and for non-text UI components (form-control borders,
  meaningful icons, focus rings) — see [WCAG 1.4.11].

## How this audit was run

Each (foreground, background) pair the app actually paints was scored with
the standard relative-luminance formula, then rated AAA / AA / AA-large /
FAIL. Pairs the app does *not* paint (e.g., `textMuted` on `accent`) were
skipped.

The script lives in `git log` history on the commit that introduced this
file — re-running it after a palette change is the way to re-verify.

## Light theme — final scores

| pair | ratio | rating |
|---|---:|---|
| textPrimary on background | 13.79 | AAA |
| textPrimary on surface | 15.20 | AAA |
| textPrimary on surfaceMuted | 13.69 | AAA |
| textSecondary on background | 8.36 | AAA |
| textSecondary on surfaceMuted | 8.30 | AAA |
| textMuted on background | 4.54 | AA |
| textMuted on surface | 5.00 | AA |
| textMuted on surfaceMuted | 4.51 | AA |
| textOnAccent on accent | 13.79 | AAA |
| textPrimary on accentSoft (pinned row) | 8.01 | AAA |
| accent on background (links) | 13.79 | AAA |
| danger on surfaceMuted (overdue date) | 5.37 | AA |
| danger on dangerSoft (overdue pill) | 4.60 | AA |
| warn on warnSoft | 4.55 | AA |
| success on successSoft | 10.22 | AAA |
| **borderStrong on surface** (checkbox) | **3.91** | UI 3:1 ✓ |
| **borderStrong on surfaceMuted** (checkbox in row) | **3.52** | UI 3:1 ✓ |
| **textPrimary on accentSoft** (pinned-row checkbox) | **8.01** | UI 3:1 ✓ |

## Dark theme — final scores

| pair | ratio | rating |
|---|---:|---|
| textPrimary on background | 13.79 | AAA |
| textPrimary on surface | 11.78 | AAA |
| textSecondary on surfaceMuted | 7.29 | AAA |
| textMuted on background | 6.73 | AA |
| textMuted on surface | 5.75 | AA |
| textMuted on surfaceMuted | 4.89 | AA |
| textOnAccent on accent | 8.01 | AAA |
| accent on background | 8.01 | AAA |
| danger on surfaceMuted (overdue date) | 6.00 | AA |
| danger on dangerSoft (overdue pill) | 6.99 | AA |
| **borderStrong on surface** (checkbox) | **3.64** | UI 3:1 ✓ |
| **textPrimary on accentSoft** (pinned-row checkbox) | **8.91** | UI 3:1 ✓ |

## Changes that were applied

The first audit run flagged six pairings as FAIL or AA-large-only. The fixes:

- Light `textMuted`: `#7a6e62` → `#766b5f`. Five-RGB-unit darken to clear AA
  on `background` and `surfaceMuted` (was 4.33 and 4.30; AA needs 4.5).
- Light `warn`: `palette.amber[500]` (`#b58a3d`) → `#7d5f2a`. The "warn on
  warnSoft" pill was 2.42 — unreadable. Now 4.55.
- Light `borderStrong`: `palette.cream[600]` (`#c8bba8`) → `#8a7c69`. The
  unchecked-checkbox border was 1.82:1 against the row surfaces — failing
  WCAG 1.4.11. Now ≥ 3.5:1 on both `surface` and `surfaceMuted`.
- Dark `borderStrong`: `#59626d` → `#7a8694`. Same checkbox issue, dark
  mode. Now 3.64:1 on `surface`.
- Dark `danger`: `palette.crimson[300]` (`#e87575`) → `palette.crimson[200]`
  (`#f3a8a8`). The overdue date text on the row was 3.95 — passes AA-large
  but fails for the actual 12-pt `xs` font size used. Now 6.00.
- TaskRow checkbox border on pinned rows (`accentSoft` background): switched
  from `borderStrong` (2.06 on accentSoft, fails) to `textPrimary` (8.01).
  Pinned-row checkboxes were the only place where the previous accent-tan
  beat the gray border into invisibility.

## Things this audit does NOT cover

- **Component-level contrast where the foreground is dynamic.** Example:
  category dots use the user-chosen category color, which the user can
  pick freely from a small palette. Those pairings against `surfaceMuted`
  haven't been audited individually because the palette was vetted by the
  design system.
- **Press states / focus rings.** RN renders Pressable's pressed state as
  a slight `surfaceMuted` overlay; the audit checked the resting state
  only.
- **Non-color signals.** WCAG 1.4.1 ("don't rely on color alone") — the
  TaskRow already pairs the overdue stripe + pill + danger date + a11y
  label so users without color get the same signal. Streak ring pairs
  accent + filled-glyph for the same reason.

[WCAG 1.4.11]: https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html
