# Streak Todo

Simple todo + scheduler app with categories, reminders, repeat rules, subtasks, and an upgrade path for premium features.

## Product direction

Primary reference points from `inspiration/app/`:

- task list with category pills across the top
- quick-add composer opened from a floating action button
- date picker with shortcuts such as Today, Tomorrow, 3 Days Later, This Sunday, and No Date
- reminder settings with lead time and type
- repeat rules including daily, weekly, monthly, yearly, and custom
- subtask input inside the composer
- premium upgrade screen for advanced reminders, widgets, templates, attachments, sync, and ad removal

## Build plan

### Phase 1: foundation

- [x] Finalize branding: app name, icon set, package IDs, and launch assets — single source in [`branding.js`](./branding.js)
- [x] Define color, spacing, type, and icon tokens for the mobile UI — see [`src/theme/`](./src/theme)
- [x] Set up navigation shell for Tasks, Calendar, and Profile tabs — expo-router under [`app/`](./app)
- [x] Add local persistence model for tasks, categories, subtasks, reminders, and repeat rules — sqlite + raw SQL repos under [`src/db/`](./src/db)
- [x] ~~Create seed/demo data for rapid UI iteration~~ — **deliberately skipped.** Phase 3 (composer) is built before Phase 2 (list), so all data is real user-created from day one. A targeted dev-only fixture helper may be added later if edge-case coverage is needed.

### Phase 2: quick add composer (build first, so the list has real data)

- [x] Add floating action button to open the task composer — see [`src/components/Fab.tsx`](./src/components/Fab.tsx)
- [x] Build bottom-sheet composer with title input — see [`src/components/TaskComposer.tsx`](./src/components/TaskComposer.tsx)
- [x] Add submit action and validation for creating a task — composer persists via `tasksRepo.createTask`, inline error + length-hint surfacing
- [x] Add inline subtask row inside the composer — atomic insert via `tasksRepo.createTaskFull`
- [x] Add category picker trigger — chip in composer + `CategoryPickerSheet` + `useCategories` hook
- [x] Build the rich Schedule sheet (date + time + reminder + repeat in one surface, matching `inspiration/app/click_on_calendar_icon.jpeg`)
  - [x] Calendar grid with month nav — [`src/components/CalendarGrid.tsx`](./src/components/CalendarGrid.tsx)
  - [x] Quick shortcuts: Today / Tomorrow / 3 Days Later / This Sunday / No Date
  - [x] Time field (opens native time picker; null = all-day)
  - [x] Reminder field (opens `ReminderPopover` with on/off + lead time + type + ScreenLock)
  - [x] Repeat field (opens `RepeatPopover` with None / Daily / Weekly / Monthly / Yearly / Custom)
  - [x] Cancel / Done footer commits to draft state, not DB
- [x] Calendar-icon trigger in composer wired to the Schedule sheet
- [x] Extend `tasksRepo` with a `createTaskFull` transaction (parent + subtasks + reminders + repeat rule)
- [x] Premium matrix scaffold — see [`src/lib/premium.ts`](./src/lib/premium.ts) (Alarm/Silent reminder, ScreenLock, Custom repeat all FREE today, tagged for later gating)

### Phase 3: task list home

- [x] Build the main task list screen — `FlatList` driven by `useTasks`
- [x] Design the base task row with checkbox, title, metadata line, and pin/star action — see [`src/components/TaskRow.tsx`](./src/components/TaskRow.tsx)
- [x] Support task completion with immediate UI feedback — optimistic patch overlay with rollback on failure
- [x] Support pinning or flagging important tasks — `tasksRepo.setPinned` + accent border on pinned rows
- [x] Add empty state and loading state for the task list — plus error state with retry
- [ ] Add grouped sections such as Previous, Today, Upcoming, and No Date
- [ ] Add top category pills: All, Work, Personal, Wishlist

### Phase 4: categories

- [x] ~~Build category dropdown from the composer~~ — covered by `CategoryPickerSheet` in Phase 2
- [x] ~~Support default categories: Work, Personal, Wishlist~~ — seeded on first launch in Phase 1
- [ ] Add create-new-category flow (composer + category management screen)
- [ ] Add category-based task filtering on the home screen (driven by Phase 3 pills)
- [ ] Persist category colors or labels for future expansion (already in schema; UI for picking color on create)

### Phase 5: scheduling (runtime semantics)

UI for date / time selection lives in the Schedule sheet (Phase 2). This phase covers everything else.

- [ ] Show scheduled date and time clearly in the task row metadata (rich row, Phase 3)
- [ ] Handle overdue styling for past-due tasks
- [ ] Group tasks into Previous / Today / Upcoming / No Date sections (Phase 3 list)
- [ ] Day grouping helper in `src/lib/date.ts`

### Phase 6: reminders (runtime engine)

UI for reminder on/off + lead time + type lives in the Schedule sheet (Phase 2). This phase wires actual OS notifications.

- [ ] Enable local notification permissions flow on first reminder save
- [ ] Schedule local notifications when a task with reminder(s) is saved
- [ ] Cancel or reschedule notifications when a task is edited, completed, or deleted
- [ ] Re-arm notifications on app launch if the OS dropped them (boot-loss recovery)
- [ ] Persist `scheduled_notification_id` on `task_reminders` rows (already in schema)
- [ ] **Premium-flagged (free for now):** Reminder Type options beyond plain notification — Alarm and Silent. Tag the dropdown options with a `premium: true` field; gate later.
- [ ] **Premium-flagged (free for now):** ScreenLock Reminder — display the task on the lock screen / always-on display. Off by default; toggle in the Reminder popover.

### Phase 7: recurrence (runtime engine)

UI for the repeat menu lives in the Schedule sheet (Phase 2). This phase computes next occurrences.

- [ ] Generate next occurrence on task completion based on `task_repeat_rules`
- [ ] Support daily / weekly / monthly / yearly recurrence math (helpers in `src/lib/date.ts`)
- [ ] Show repeat status in task metadata (rich row, Phase 3)
- [ ] Respect `until_at` (stop generating after that date)
- [ ] **Premium-flagged (free for now):** Custom repeat rule (e.g. "every 3 weeks on Mon/Wed"). Implement now; mark the menu item as gateable later.

### Phase 8: task details and editing

- [ ] Add edit flow for existing tasks
- [ ] Add task detail screen or expanded editor
- [ ] Edit title, category, due date, time, reminder, repeat, and subtasks
- [ ] Delete task flow
- [ ] Duplicate task flow
- [ ] Preserve completed-task history

### Phase 9: calendar and views

- [ ] Build Calendar tab
- [ ] Add month view with selected-day task list
- [ ] Highlight days that contain tasks or reminders
- [ ] Support switching between list and calendar context without losing filters
- [ ] Add quick jump to Today

### Phase 10: profile and settings

- [ ] Build Profile tab
- [ ] Add account state, sign-in status, and sign-out
- [ ] Add notification settings summary
- [ ] Add category management screen
- [ ] Add theme/settings scaffold
- [ ] Migrate `SignInScreen` and `NotificationsScreen` off the deprecated `colors` shim onto `useTheme()` (currently pinned to light theme)
- [ ] Delete `src/theme/colors.ts` shim once the migration is done
- [ ] Add data export/import placeholder if needed later

### Phase 11: premium groundwork

> **Stance: build features now, gate them later.** Anything we'd otherwise mark "premium" ships free in V0 and is tagged with a `premium: true` flag (or commented `// premium-future`) so the gating layer can find it later. This phase is purely about the gating + monetization scaffolding, not about restricting features.

Currently flagged as future-premium (already free in code):
- Reminder Type options beyond plain notification (Alarm, Silent) — see Phase 6
- ScreenLock Reminder toggle — see Phase 6
- Custom repeat rules — see Phase 7

To do in this phase:

- [ ] Build Upgrade to Pro screen
- [ ] Define the free vs pro matrix and ship it as `src/lib/premium.ts`
- [ ] Wire each `premium: true` tag to the matrix so flipping a single flag gates the feature
- [ ] Add placeholders for attachments, templates, widgets, and sync
- [ ] Add restore purchases and billing flow later

### Phase 12: polish and release readiness

- [ ] Add onboarding for first launch
- [ ] Add animations for composer open/close and task completion
- [ ] Improve accessibility for touch targets, labels, and contrast
- [ ] Add offline-safe persistence migration plan
- [ ] Add analytics/events plan if required
- [ ] Add Play Store screenshots, description, privacy policy, and release checklist

### Phase 13: collaboration and accountability

- [ ] Add account-backed sync as a prerequisite for collaboration
- [ ] Add friend invite flow via email
- [ ] Add incoming invite acceptance and rejection flow
- [ ] Add friend list management
- [ ] Add assign-to-friend support on tasks
- [ ] Add received-task inbox or assigned-task section
- [ ] Add task activity events for assignment, completion, and updates
- [ ] Add streak comparison or accountability views between connected users
- [ ] Add privacy and permission rules for personal vs assigned tasks
- [ ] Add collaboration notifications for invites, assignments, and completions

### Phase 14: backup, restore, and sync

- [ ] Define canonical JSON export shape across all tables
- [ ] Implement local JSON export with `expo-sharing`
- [ ] Implement JSON import with conflict and version checks
- [ ] Add backup/restore UI in the Profile tab
- [ ] Define server contract for cloud sync
- [ ] Implement cloud sync with last-write-wins or vector-clock strategy

## Current implementation status

- [x] Expo app shell exists
- [x] Android local dev build path exists
- [x] Google sign-in wiring exists
- [x] Local notification test surface exists
- [x] Streak Todo branding is in place
- [ ] Product task system is not built yet
- [ ] Calendar experience is not built yet
- [ ] Premium flow is not built yet
- [ ] Collaboration features are intentionally deferred until the single-user product and sync are stable

## Public repo note

Follow [`REPO_HYGIENE.md`](./REPO_HYGIENE.md) before every push.
