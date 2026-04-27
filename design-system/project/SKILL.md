---
name: streak-todo-design
description: Use this skill to generate well-branded interfaces and assets for Streak Todo, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick orientation

- **Tone:** honest, calm, lowercase-friendly. No fake encouragement. No emoji except `👑` for premium-flagged items.
- **Palette:** warm cream backgrounds (NOT white), deep evergreen-charcoal accents, amber for warning/premium, crimson for overdue/destructive. Never bright SaaS blue.
- **Surfaces:** filled muted cards over stroked ones. Borders are usually invisible.
- **Tokens:** consume semantic vars from `colors_and_type.css` (`--color-accent`, `--color-surface-muted`, `--space-md`, `--radius-lg`, etc). Never reach for raw palette steps in product UI.
- **UI kit:** `ui_kits/streak-todo/` is a working click-thru — read its components before designing new screens; match its checkbox, pill, FAB, task-row, and bottom-sheet patterns exactly.
- **Phase 10 (streaks + charts):** see the `preview/streak-states.html`, `preview/chart-*.html`, and `preview/comp-calendar-grid.html` cards plus the README's Phase 10 section. Streaks are honest (no fire emoji, missed days shown in `danger`), charts use only the four status colors (`accent` / `danger` / `textMuted` / `accentSoft`), donut slices use the CreateCategoryDialog swatch palette, and all chart numbers use `tabular-nums`.
