# Streak Todo — Design System

> An honest discipline app for solo creators.
> A mobile-first todo + scheduler with categories, calendar, reminders,
> recurring tasks, and a streak counter that doesn't lie about missed days.
> Android-first (iOS later), built on Expo + TypeScript.

## What's in the product

A single React Native (Expo) app, today, with these surfaces:

- **Tasks tab** — Today / Previous / Upcoming sections; filtered by category pills; FAB opens the composer
- **Calendar tab** — month grid with task markers
- **Notifications screen** — scheduled reminder list
- **Sign-in screen** — Google sign-in entry point
- **Bottom-sheet composer** — title, subtasks, category chip, schedule (date + time + reminder + repeat)
- **Anchored popovers** — category picker, repeat picker, reminder picker

There is no marketing site, no docs site, no second product. **One UI kit: the
mobile app.**

## Sources

- **Codebase** — `src/theme/` and `src/components/` remain authoritative for
  runtime tokens and component behavior.
- **App icon** — `uploads/adaptive-icon.png` → copied to `assets/app-icon.png`.

No Figma, no slide deck, no marketing brand book was provided — everything
in this design system is reverse-engineered from `src/theme/` and the
component files in `src/components/`.

## Repository index

```
README.md                  ← you are here
colors_and_type.css        ← CSS vars for the full token system (light + dark)

assets/
  app-icon.png             ← adaptive icon (rounded square, charcoal + amber arc)

preview/                   ← design-system cards (Design System tab)
  brand-logo.html
  colors-palette-cream.html
  colors-palette-evergreen.html
  colors-palette-amber-crimson.html
  colors-semantic-light.html
  colors-semantic-dark.html
  type-scale.html
  type-roles.html
  spacing-scale.html
  radius-scale.html
  elevation.html
  iconography.html
  comp-buttons.html
  comp-pills.html
  comp-task-row.html
  comp-fab.html
  comp-checkbox-and-star.html
  comp-input-and-chip.html
  comp-section-header.html

ui_kits/
  streak-todo/             ← mobile app UI kit
    README.md
    index.html             ← interactive Android-frame click-thru
    tokens.css             ← scoped copy of the design tokens
    Frame.jsx              ← Android device chrome
    AppShell.jsx           ← bottom tab bar + screen switcher
    TasksScreen.jsx
    CalendarScreen.jsx
    ProfileScreen.jsx
    Composer.jsx           ← bottom sheet
    SchedulePicker.jsx     ← date/time/reminder/repeat sheet
    CategoryMenu.jsx       ← anchored popover
    primitives.jsx         ← TaskRow, Pill, Fab, Checkbox, Star, Icon
```

## Content fundamentals

Streak Todo's voice is **honest, calm, direct.** It does not gamify or
fake-encourage. It does not high-five you for missing a day.

- **Casing.** Sentence case everywhere. Section headers are bold but
  sentence-case ("Today", "Previous", "Upcoming"). UI labels are short
  and concrete ("No Category", "Tomorrow", "3 Days Later", "No Date").
  ALL-CAPS is reserved for the few moments that benefit from it: month
  labels in the calendar header (`SEP 2025`), and the footer actions in
  the schedule sheet (`CANCEL` / `DONE`).
- **Person.** Imperative. Buttons say what they do — "Sign in with Google",
  "Add subtask", "Set schedule". Avoid "you" except in long help copy
  ("Sign in to plan content, schedule tasks, and keep a streak.").
- **Length.** As short as it can be without being cryptic. "Input new task
  here" beats a paragraph. Helper text is one sentence, not three.
- **Counts.** Section headers do **not** carry a count number — no
  `Today (4)`. The list itself is the count.
- **Numbers and time.** Tabular nums for counters and times so a
  countdown doesn't shift width. Lower-case meridiem (`06:55 am`).
  Relative dates take precedence over absolute when they read clearly
  ("Tomorrow", "3 days later"), absolute when they don't.
- **Status copy.** Overdue is shown with color and weight, not exclamation
  points. The streak counter never says "you missed a day, no worries!" —
  if you missed it, the streak is broken and the UI says so.
- **Emoji.** Almost never. The single sanctioned emoji is **👑** for
  premium-flagged options (templates, etc.). No 🎉, no 🔥, no ✅. Status
  glyphs (overdue, reminder, repeat) come from the icon font, not emoji.
- **Examples in product copy.**
  - Title input placeholder: `Input new task here`
  - Subtask placeholder: `Input the sub-task`
  - Category default: `No Category`, plus `+ Create New` at the bottom of
    the menu
  - Schedule shortcuts: `Today`, `Tomorrow`, `3 Days Later`,
    `This Sunday`, `No Date`
  - Sign-in caption: `Sign in to plan content, schedule tasks, and keep a streak.`
  - Disabled hint on a Time row when there's no date yet: `Pick a date first`

## Visual foundations

### Color
**Warm cream + dark charcoal.** This is **not** a bright SaaS palette —
the page background is a soft cream (`#f4efe6`), surfaces are a slightly
warmer cream, and the primary "accent" in light mode is near-black
charcoal (`#1F2328`). Evergreen plays the success role; amber is warning
and the premium tint; crimson is destructive and overdue. Dark mode
flips to a slate-greyed surface stack with a tan accent (`#D2B48C`).

Five palettes (cream, evergreen, amber, crimson, slate) live in
`src/theme/tokens.ts`. **Components consume only semantic tokens** from
`src/theme/theme.ts` (`accent`, `surfaceMuted`, `textOnAccent`, `dangerSoft`,
…). Re-skinning is done by remapping semantics, not by editing components.

### Type
System font stack — `-apple-system, Segoe UI, Roboto, …`. No webfont. Type
scale runs `xs 11 → 5xl 42`; weights `regular 400 / medium 500 / semibold
600 / bold 700 / heavy 800`. Tabular numerals on counters. Letter spacing
is mostly `0`; ALL-CAPS labels get `+1.2px`.

### Spacing & rhythm
4px base unit. `xs 4 / sm 8 / md 12 / lg 16 / xl 20 / 2xl 24 / 3xl 32 /
4xl 40 / 5xl 56 / 6xl 72`. Screen padding is usually `xl` (20). Cards have
`lg` internal padding. Action rows gap by `sm` (8).

### Backgrounds
**Flat warm cream — no gradients, no images, no patterns, no textures.**
The whole appeal is the unbroken cream field. Full-bleed photography is
not part of the language. The only "surface effects" are the gentle
elevation shadows behind the FAB (and the soft tan halo behind it).

### Borders
**Filled cards, not stroked cards.** Visible 1px borders are reserved for
menus/popovers, the sign-in hero card, and the schedule sheet — places
where a surface needs to read as separate from the page. Task rows,
category pills, and the composer field are filled muted surfaces with no
border at all.

### Radii
`sm 6 / md 10 / lg 14 / xl 18 / 2xl 22 / 3xl 28 / pill 999`. Cards use
`lg`→`2xl`. The bottom sheet uses `3xl` on its top corners only. Pills
and circular buttons use `pill`. The FAB is a perfect circle.

### Shadows / elevation
Three shadow rungs, all warm (shadow color is cream-900 / brown, not
neutral grey).
- `sm` — barely there, for subtle separation
- `md` — composer, popovers, anchored menus
- `lg` — FAB, sign-in CTA. Shadow color is the **accent** itself for the
  FAB so the glow reads as a brand color, not as grey haze.

The FAB additionally renders a **soft accent halo** (a slightly larger
`accentSoft` circle at `0.55` opacity behind it) — that's the brand
move, not a CSS shadow trick.

### Hover / press states
Built for touch first.
- **Press (tap-down)** — primary buttons drop to `0.85` opacity and
  scale to `0.95–0.96`. The FAB does both. Pills swap from `surfaceMuted`
  to `accentMuted` on press.
- **Hover** — n/a on a touch device. In the web kit we mirror the press
  state on hover for parity.
- **Disabled** — `0.4` opacity. Disabled rows in the schedule sheet add
  `0.5` opacity and a `Pick a date first`-style hint.

### Selection
Pill buttons: selected = accent fill + `textOnAccent`; unselected =
`surfaceMuted` + `textPrimary`. **No outline ring, no color dot.**
Calendar day cells: selected = solid accent fill (full circle). Today
without a selection = accent text color, no fill.

### Transparency / blur
Used sparingly. The scrim behind a sheet is `rgba(31, 35, 40, 0.45)`.
There is no backdrop-filter blur — Android-first, performance-first.

### Animation
Three durations only: `fast 120ms`, `normal 200ms`, `slow 320ms`. Modals
slide up. Popovers fade. Press states are an instant scale, no spring.
Standard ease (`cubic-bezier(0.2, 0, 0, 1)`). **No bounces**, no skeuomorphic
spring physics — that would betray the "honest" voice.

### Imagery
Almost none. The product UI is text + icons + the FAB. The app icon is
the only branded artwork: a charcoal rounded-square with a cream
checkmark inside an offset ring, where the top-right segment of the
ring is amber (the streak progress). That ring/check motif is the
single visual idea; everything else is typographic.

### Cards
Three card recipes:
1. **Filled card** (default, `surfaceMuted` fill, `radius-lg`, no border,
   no shadow) — task rows, composer field. The dominant card style.
2. **Hero / popover card** (`surfaceRaised` fill, `radius-2xl`, 1px
   border, `shadow-lg`) — sign-in card, schedule sheet.
3. **Sheet** (`surface` fill, top-only `radius-3xl`, drag handle on top,
   no header bar) — composer, schedule pickers.

### Layout rules
- Screen padding `--space-xl` (20px) horizontal.
- Bottom tab bar (3 tabs: Tasks, Calendar, Profile) is fixed.
- FAB lives at bottom-right, `20px` from each edge, **above** any bottom
  bar. The halo extends 8px beyond the FAB on every side.
- Section headers stick to the top of the list as you scroll? — no.
  They're plain and scroll with the content.

## Iconography

- **Library:** `@expo/vector-icons` → **Ionicons** under the hood.
- **Routing:** every icon goes through `src/components/Icon.tsx`, a thin
  wrapper that maps a small named set (`calendar`, `subtask`, `template`,
  `send`, `time`, `reminder`, `repeat`, `tasks`, `calendar-tab`, `profile`,
  `reminder-filled`, `repeat-filled`, `star`, `star-filled`, `check`,
  `close`, `trash`) to Ionicons names. The library is a **single point
  of swap** — components never import Ionicons directly.
- **Style:** outline by default; filled variants are explicit
  (`star-filled`, `reminder-filled`, `repeat-filled`). Strokes are
  Ionicons' default weight; sizes are `12 / 14 / 18 / 20 / 22` depending
  on context (meta row, checkbox glyph, action button, large primary).
- **Color:** icons inherit the *role* of the element they live in.
  Muted meta = `--color-text-muted`. Tab bar inactive =
  `--color-text-secondary`. Tab bar active = `--color-accent`. Pin
  star when pinned = `--color-accent`. Check inside a completed
  checkbox = `--color-text-on-accent` on an accent fill.
- **Pin metaphor.** Important tasks use a **star (★/☆)**, not a flag.
- **Emoji as icons.** Don't. The only sanctioned emoji is 👑 next to
  premium-flagged options (e.g. Templates).
- **Unicode chars.** The composer's close button uses `×` (multiplication
  sign), and the calendar header uses `‹` / `›` for prev/next month.
  Both are typeset, not iconified — they're typographic furniture.

For the web design system we use **Ionicons via CDN**
(`https://unpkg.com/ionicons@7.1.0/dist/ionicons.js`) so previews match
the device exactly. If the CDN is unreachable in a particular preview,
fall back to the SVGs cached in `assets/icons/`.

## Open questions / caveats

- **No real Figma file** — every component spec was reverse-engineered
  from the React Native source. If a Figma source of truth exists,
  attach it; some sub-states (focus, hover on web ports) are inferred.
- **No marketing brand book** — the "voice" rules above were synthesized
  from in-product copy and the brief. A formal voice guide would let
  us tighten the examples list.
- **App icon is a single PNG.** A vector master would let the icon scale
  cleanly into the design-system cards.

## Phase 10 — Streaks & charts (design ahead of ship)

These surfaces aren't in `src/` yet. The cards in `preview/` are the source
of truth until they land in code. The rules below are non-negotiable — they
exist to keep the brand honest and the visualizations on-palette.

### Streak counter

Honest, never motivational. Forbidden: fire emoji, celebratory glyphs,
inflated copy.

| State | Treatment |
| --- | --- |
| **Active streak** | Bold large number, accent color, `tabular-nums`, plus "day streak". |
| **Today completed** | Filled accent ring around the number. |
| **Today pending** | Outlined accent ring. Number stays in `textPrimary`. |
| **Missed** | Visible red dot or strike on the day in history. Use `danger`. Never hide misses. |
| **Caption row** | `current 12 days · best 34 days · missed this month 2`. Misses in `danger`. |

See: `preview/streak-states.html`.

### Charts

Match the muted-cream language. Never use chart-library defaults — they
will arrive as rainbow-bright SaaS palettes.

**Bar chart — weekly completion**
- Bars: `accent`
- Today: `surfaceMuted` with dashed `accent` outline
- Empty / upcoming: `surfaceMuted` solid
- Axis labels: `textMuted` at `fontSize.xs`
- No gridlines unless absolutely needed; if used, divider color

**Line chart — streak trend**
- Stroke: `accent` at 2px
- Area fill: `accentSoft` at 0.4 opacity (gradient to 0 at the bottom is fine)
- Dots only on hover/select, never on every point. Hover dot = solid accent
  with a soft accent halo at ~0.18

**Donut / progress rings — category breakdown**
- Slice colors: the user's category color (chosen from CreateCategoryDialog
  swatch palette: `evergreen-400 #3f7e69`, `amber-500 #b58a3d`,
  `crimson-500 #d44a4a`, `evergreen-700 #2c5a4b`, `#5b6c89`, `#7a4c8a`,
  `#2f7d4d`, `#c1592b`)
- Track / background: `surfaceMuted`

**Status colors — shared across all charts**

| Status | Token |
| --- | --- |
| completed | `accent` |
| overdue / missed | `danger` |
| skipped | `textMuted` |
| upcoming / scheduled | `accentSoft` |

**Numbers** in any chart use `font-variant-numeric: tabular-nums` so
they don't jitter as values change.

### Calendar grid

6 rows × 7 columns. Sunday-first.

| Cell | Treatment |
| --- | --- |
| Default | `textPrimary`, transparent |
| Other-month | `textMuted` at 0.5 opacity |
| Today | `accent` text, weight 700, transparent fill |
| Selected | `accent` fill + `textOnAccent` |
| Has tasks | small dot under the number (`accent`, or `textOnAccent` when selected) |
| Missed day | dot in `danger` |

In the **composer** date picker, past days are dimmed and non-tappable.
In the **Calendar tab**, past days are still selectable so users can
review what they did (or didn't) do. See: `preview/comp-calendar-grid.html`.

## Index

| File | Purpose |
| --- | --- |
| `colors_and_type.css` | Full token system (CSS vars, semantic + raw, light + dark) |
| `assets/app-icon.png` | The only branded artwork |
| `preview/*.html` | Design-system cards rendered into the Design System tab |
| `ui_kits/streak-todo/` | High-fidelity recreation of the mobile app |
