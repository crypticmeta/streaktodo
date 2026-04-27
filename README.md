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
- [ ] Add submit action and validation for creating a task
- [ ] Add inline subtask row inside the composer
- [ ] Add category picker trigger
- [ ] Add date picker trigger
- [ ] Add reminder trigger
- [ ] Add repeat trigger

### Phase 3: task list home

- [ ] Build the main task list screen
- [ ] Design the base task row with checkbox, title, metadata line, and pin/star action
- [ ] Support task completion with immediate UI feedback
- [ ] Support pinning or flagging important tasks
- [ ] Add empty state and loading state for the task list
- [ ] Add grouped sections such as Previous, Today, Upcoming, and No Date
- [ ] Add top category pills: All, Work, Personal, Wishlist

### Phase 4: categories

- [ ] Build category dropdown from the composer
- [ ] Support default categories: Work, Personal, Wishlist
- [ ] Add create-new-category flow
- [ ] Add category-based task filtering on the home screen
- [ ] Persist category colors or labels for future expansion

### Phase 5: scheduling

- [ ] Build date picker modal with month navigation
- [ ] Add quick date shortcuts: Today, Tomorrow, 3 Days Later, This Sunday, No Date
- [ ] Support optional task time
- [ ] Show scheduled date/time clearly in the task row metadata
- [ ] Handle overdue styling for past-due tasks

### Phase 6: reminders

- [ ] Enable local notification permissions flow
- [ ] Add reminder on/off state in the composer
- [ ] Add reminder lead time options such as at time, 5 minutes before, 15 minutes before, 1 hour before
- [ ] Add reminder type options for the free tier baseline
- [ ] Save reminder metadata on the task model
- [ ] Schedule local notifications for dated tasks
- [ ] Cancel or reschedule notifications when a task is edited or completed

### Phase 7: recurrence

- [ ] Add repeat options: None, Every Day, Weekly, Monthly, Yearly, Custom
- [ ] Support weekly repeat by weekday
- [ ] Support monthly repeat by calendar day
- [ ] Support yearly repeat by month and day
- [ ] Define behavior for completing recurring tasks and generating the next occurrence
- [ ] Show repeat status in task metadata

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
- [ ] Add data export/import placeholder if needed later

### Phase 11: premium groundwork

- [ ] Build Upgrade to Pro screen
- [ ] Define free vs pro matrix based on the reference list
- [ ] Gate advanced reminders behind premium
- [ ] Gate advanced repeat/custom rules behind premium if needed
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
