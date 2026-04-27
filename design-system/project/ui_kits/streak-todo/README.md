# Streak Todo · Mobile UI Kit

Click-thru recreation of the Streak Todo Android app.

**Files**
- `index.html` — interactive prototype (412×892 device frame)
- `tokens.css` — scoped tokens, sheet/scrim utilities, press states
- `primitives.jsx` — Icon, Checkbox, Star, Pill, Fab, TaskRow
- `Composer.jsx` — bottom-sheet composer (title + subtasks + category chip + schedule)
- `SchedulePicker.jsx` — calendar + shortcuts + time/reminder/repeat rows
- `TasksScreen.jsx` — Today / Upcoming / Previous + category pills
- `CalendarScreen.jsx` — month grid with markers
- `ProfileScreen.jsx` — honest streak counter + settings
- `AppShell.jsx` — bottom tab bar + composer mount

**What works** Tap a category pill to filter. Tap a checkbox to mark
done. Tap the star to pin. Tap the FAB to open the composer; type a
title, pick a category from the popover, tap the calendar to open the
schedule picker, hit the circular send button to save. Tap an existing
task to edit. Switch tabs to Calendar (pick days) or Profile (streak).

**What's faked** Persistence (in-memory state). Time picker (no native
spinner). Reminder/Repeat popovers (rows present but not interactive).
Sign-in screen (use the brand foundations card instead).
