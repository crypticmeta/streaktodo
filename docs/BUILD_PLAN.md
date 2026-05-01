# Streak Todo — Build Plan

> **Internal engineering log.** This document captures the phase-by-phase
> plan we worked through to ship Streak Todo v1.0, including decisions
> we deliberately deferred and the reasoning behind them. The
> [front-door README](../README.md) is for visitors; this is for
> engineers maintaining the codebase.

Simple todo + scheduler app with categories, reminders, repeat rules, subtasks, and a clean local-first workflow.

## Design system

`design-system/` contains the visual source of truth for the mobile UI.
Read `design-system/README.md` and
`design-system/project/colors_and_type.css` before changing tokens or
component styling.

## Product direction

Primary reference points from `inspiration/app/`:

- task list with category pills across the top
- quick-add composer opened from a floating action button
- date picker with shortcuts such as Today, Tomorrow, 3 Days Later, This Sunday, and No Date
- reminder settings with lead time and type
- repeat rules including daily, weekly, monthly, yearly, and custom
- subtask input inside the composer
- calendar tab with a selected-day task list
- profile dashboard with account summary and task stats
- task edit/details screen with category, reminder, repeat, and notes rows

## Scope guardrails

- No attachment support for now
- No premium gating for now
- No upgrade banners or paywall flows for now
- All implemented features remain free in the current product

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
- [x] Product scope remains fully free with no visible upgrade surface

### Phase 3: task list home

- [x] Build the main task list screen — `FlatList` driven by `useTasks`
- [x] Design the base task row with checkbox, title, metadata line, and pin/star action — see [`src/components/TaskRow.tsx`](./src/components/TaskRow.tsx)
- [x] Support task completion with immediate UI feedback — optimistic patch overlay with rollback on failure
- [x] Support pinning or flagging important tasks — `tasksRepo.setPinned` + accent border on pinned rows
- [x] Add empty state and loading state for the task list — plus error state with retry
- [x] Add grouped sections such as Previous, Today, Upcoming, and No Date — see [`src/lib/taskGrouping.ts`](./src/lib/taskGrouping.ts), rendered via `SectionList`
- [x] Add top category pills: All, Work, Personal, Wishlist — see [`src/components/CategoryPills.tsx`](./src/components/CategoryPills.tsx)

### Phase 4: categories

- [x] ~~Build category dropdown from the composer~~ — covered by anchored `CategoryPickerMenu` in Phase 2 (replaced the earlier sheet)
- [x] ~~Support default categories: Work, Personal, Wishlist~~ — seeded on first launch in Phase 1
- [x] Add create-new-category flow — `+ Create New` row in the menu opens [`CreateCategoryDialog`](./src/components/CreateCategoryDialog.tsx) with name input + color swatches; persists via `categoriesRepo.createCategory`
- [x] Add category-based task filtering on the home screen — Phase 3 pills wired through `useTasks({ categoryId })`
- [x] Persist category colors — color swatch chosen at create time is stored on the row
- [x] Category management screen (rename / recolor / delete) — see Phase 10 entry; reorder still deferred

### Phase 5: scheduling (runtime semantics)

UI for date / time selection lives in the Schedule sheet (Phase 2). This phase covers everything else.

- [x] Show scheduled date and time clearly in the task row metadata — `TaskRow` meta line renders date + time + reminder + repeat icons
- [x] Handle overdue styling for past-due tasks — left-edge danger stripe (suppressed for pinned rows) + uppercase "Overdue" pill in the meta row + danger-tinted date text. Screen-reader label includes the overdue state and category name so grayscale/a11y users get the same signal.
- [x] Group tasks into Previous / Today / Upcoming / No Date sections — see [`src/lib/taskGrouping.ts`](./src/lib/taskGrouping.ts)
- [x] Day grouping helper in `src/lib/date.ts` — `startOfDay`, `addDays`, etc.

### Phase 6: reminders (runtime engine)

UI for reminder on/off + lead time + type lives in the Schedule sheet (Phase 2). This phase wires actual OS notifications.

- [x] Enable local notification permissions flow on first reminder save — see [`src/lib/notificationScheduler.ts`](./src/lib/notificationScheduler.ts) `ensurePermission` + `ReminderPopover` warning banner if denied
- [x] Schedule local notifications when a task with reminder(s) is saved — `scheduler.scheduleForTask` in `app/(tabs)/index.tsx` `handleSubmit`
- [x] Cancel or reschedule notifications when a task is completed, uncompleted, or deleted — wired into `handleToggleComplete`; soft-delete cancellation still pending until task editing/delete UI ships
- [x] Re-arm notifications on app launch if the OS dropped them (boot-loss recovery) — `scheduler.reconcileAll()` in `_layout.tsx` after DB ready
- [x] Persist `scheduled_notification_id` on `task_reminders` rows — done
- [x] ~~Optional reminder types beyond plain notification — Alarm and Silent~~ — **deferred.** Silent is Expo-supported (low-importance Android channel + `sound: null`) but the schema is already in place and standard notifications cover the V0 product loop. Alarm requires a custom Android native module (`USE_EXACT_ALARM` special permission + full-screen activity + foreground service), incurs ongoing maintenance as Android tightens alarm policy each release, and triggers extra Play Store review scrutiny. Revisit when a real user has asked for one of these and the cost/benefit flips.
- [x] ~~ScreenLock reminder option — display the task on the lock screen / always-on display~~ — **deferred.** Notifications already appear on the lock screen for free when the user's system privacy settings allow it; the "always-on display" version isn't reliably achievable cross-OEM (Samsung / Pixel / Xiaomi each have different AOD APIs and there is no portable Android contract). Not worth a per-OEM integration burden for a V0 single-user product.
- [x] Hide unimplemented reminder UI from the current product surface

### Phase 7: recurrence (runtime engine)

UI for the repeat menu lives in the Schedule sheet (Phase 2). This phase computes next occurrences.

- [x] Generate next occurrence on task completion based on `task_repeat_rules` — `tasksRepo.spawnNextOccurrence` clones the task + subtasks + reminders + repeat rule into the next slot
- [x] Support daily / weekly / monthly / yearly recurrence math — see [`src/lib/recurrence.ts`](./src/lib/recurrence.ts) `nextOccurrence(rule, fromTs)`
- [x] Show repeat status in task metadata — `🔁` indicator already wired in `TaskRow` via `taskIdsWithRepeat`
- [x] Respect `until_at` — `nextOccurrence` returns `null` once exceeded, spawn becomes a no-op
- [x] Custom repeat rule editor — see [`src/components/CustomRepeatSheet.tsx`](./src/components/CustomRepeatSheet.tsx). Opens from the RepeatPopover's "Custom…" row. Surfaces frequency unit (daily/weekly/monthly/yearly) + intervalN stepper + weekday multi-picker (weekly only) + optional `untilAt` end date via the existing `CalendarGrid`. Round-trips faithfully via `useTaskEditor.initialFromGraph`: rules saved as `freq: 'custom'` re-open as custom; rules with `intervalN > 1` also re-open as custom; clean preset rules (`intervalN === 1`, freq is one of the four) re-open as the matching preset. `recurrence.ts:'custom'` now infers the underlying frequency unit from `byWeekday` / `byMonthDay` / `byMonth` presence. Day-of-month and month overrides are still derived from the anchor date (not user-overridable yet) — add later if a user asks.
- [x] Hide unimplemented custom-repeat UI from the current product surface

### Phase 8: task details and editing

- [x] Add edit flow for existing tasks — tap a row's body opens the composer in edit mode (`tasksRepo.getTaskGraph` + `ComposerInitial`)
- [x] ~~Add task detail screen or expanded editor~~ — collapsed into the composer's edit mode for V0 (one canvas for create + edit)
- [x] Edit title, category, due date, time, reminder, repeat, and subtasks — all flow through `tasksRepo.updateTaskFull` (single transaction, replaces child rows)
- [x] Delete task flow — trash icon in the composer's action row (edit mode only) with `Alert.alert` confirm; cancels reminders + soft-deletes
- [ ] Duplicate task flow — deferred until there's a long-press menu on rows
- [x] Preserve completed-task history — `Show done` / `Showing done` toggle pill in the Tasks tab header; persisted to SecureStore (`tasks_show_done_v1`); flips `useTasks` between `status: 'pending'` (default, hides completed rows) and `status: 'all'`. Completed tasks were always preserved in the DB; this exposes them in the UI.
- [x] Add richer edit/details presentation inspired by `update_screen.jpeg` — partial: edit mode now lifts the category chip up above the title (single-source-of-truth `categoryChipNode` carries `chipRef` so the picker menu still anchors correctly). Skipped: summary-row reskin of the action row (the icon-bar + Schedule sheet already surface the same data one tap away — net win not worth the conditional-layout cost) and overflow menu (no actions to put there until duplicate-task ships, which itself depends on a long-press menu).
- [x] Add notes editing — multiline notes input in the composer between subtasks and the action row; 1000-char cap; trimmed empty values stored as `null`; round-trips through `tasksRepo.createTaskFull` / `updateTaskFull` (the column already existed in schema). Plumbed through `ComposerSubmitInput`, `ComposerInitial`, `useTaskEditor`. Tracked in `task_created` analytics via `has_notes` flag. Surface in the row: small `note` icon (Ionicon `document-text-outline`) appears in the `TaskRow` meta line when notes are non-empty, sitting alongside the existing reminder + repeat icons; screen-reader label gains `"has notes"` for users who don't see the icon.
- [ ] Attachment support intentionally deferred out of scope
- [x] Hide unimplemented templates / attachment-related UI from the current product surface

### Phase 9: calendar and views

- [x] Build Calendar tab — see [`app/(tabs)/calendar.tsx`](./app/(tabs)/calendar.tsx)
- [x] Add month view with selected-day task list — `CalendarGrid` + filtered `useTasks({ dueAtMin/dueAtMax })` + reused `TaskRow`
- [x] Highlight days that contain tasks — new `tasksRepo.listDueDaysInRange` feeds `CalendarGrid`'s `markedDays` prop (small dot under days with tasks)
- [x] ~~Switch between list and calendar context without losing filters~~ — separate tabs intentionally; the Tasks tab keeps category filter, Calendar keeps day-pick. Cross-context state-sharing deferred unless usage shows it's needed.
- [x] Add quick jump to Today — pill button in the header
- [x] Editor reuse — both tabs share `useTaskEditor` (`src/lib/useTaskEditor.tsx`), so create/edit/delete paths stay in one place
- [x] Add collapse / expand affordance in the calendar header — chevron toggle flips `CalendarGrid` between `mode='month'` (6×7 grid) and `mode='week'` (single 7-cell strip with week-stepping arrows); anchor snaps so the selected day stays visible across mode switches
- [x] ~~Add calendar overflow actions~~ — deferred: a kebab with one item that already exists in the header is busywork. Will revisit when a real second action emerges (e.g. category filter, show-completed-only)
- [x] Refine the selected-day task card styling — small uppercase count label (`3 TASKS` / `NOTHING SCHEDULED`) and friendlier empty state above the list
- [x] Mute past-date cells on the Calendar tab — 0.55 opacity + muted text so they read as historical; still tappable so users can review history. Composer's date picker keeps its hard block (`disablePast=true` default).

### Phase 10: profile and settings

- [x] Build Profile tab as a dashboard surface — see [`app/(tabs)/profile.tsx`](./app/(tabs)/profile.tsx)
- [x] Add account state, sign-in status, streak summary, and sign-out — user bar at top, `StreakCounter`, sign-out button at bottom
- [x] ~~Add upgrade banner equivalent~~ — intentionally out of scope; product is fully free
- [x] Add weekly completion chart — `BarChart` (Phase 10 design spec) using `computeWeeklyCompletion`
- [x] Add category breakdown chart — `DonutChart` (SVG via `react-native-svg`) using `computeCategoryBreakdown`
- [x] Migrate `SignInScreen` and `NotificationsScreen` off the deprecated `colors` shim onto `useTheme()` — both screens now follow light/dark via the theme provider
- [x] Delete `src/theme/colors.ts` shim — done
- [x] Add task overview summary cards (totals — total / done / pending / overdue) — `OverviewTotals` card above `StreakCounter` driven by `computeOverviewTotals`
- [x] Add next 7 days summary block — `UpcomingWeek` strip; distinct from the retrospective `BarChart`
- [x] ~~Add notification settings summary~~ — removed. The dev-only test surface and its Profile link have been deleted; the production reminders engine itself (`src/lib/notificationScheduler.ts`) still ships.
- [x] Add category management screen (rename / recolor / delete) — `app/categories.tsx`, reached from "Manage categories" row on Profile
- [x] Add theme/settings scaffold (force-light / force-dark / system toggle, stored in `expo-secure-store`) — `ThemeToggle` segmented control on Profile, persisted under key `theme_preference_v1`
- [ ] Add data export/import placeholder if needed later

### Phase 11: free product guardrails

Current product direction is fully free.

- [x] Keep the shipped product fully free
- [ ] Revisit monetization only if the core product is strong and there is a clear reason to change scope
- [ ] Re-introduce premium-flagged UI only when the underlying features actually exist
- [ ] Re-introduce templates UI when task templates are implemented
- [x] ~~Re-introduce custom repeat UI when the custom repeat editor exists~~ — editor shipped (Phase 7); accessible from the RepeatPopover's "Custom…" row.
- [ ] Re-introduce advanced reminder UI when silent/alarm/screen-lock reminders actually work

### Phase 12: polish and release readiness

- [x] Add onboarding for first launch — see [`app/onboarding.tsx`](./app/onboarding.tsx) (3 swipeable slides, completion stored in `expo-secure-store` via [`src/lib/onboarding.ts`](./src/lib/onboarding.ts), gated in `_layout.tsx`)
- [x] Add animations for composer open/close and task completion — `TaskComposer` now drives a synchronized scrim-fade + sheet-translate via `Animated` (replacing RN's default `slide`); keyboard avoidance composes through `Animated.subtract` so the transform array stays stable. `TaskRow` pulses the checkbox on toggle-to-done and dims the title via animated opacity (strike-through stays static — `textDecorationLine` isn't animatable). First-mount runs are skipped so completed rows don't pulse on scroll-in.
- [x] Improve accessibility for touch targets, labels, and contrast — focused label pass (SignInScreen, SchedulePickerSheet `×` glyphs, CalendarGrid day cells); skipped redundant labels for controls whose visible text already reads through TalkBack. Color-contrast audit shipped: see [`src/theme/CONTRAST_AUDIT.md`](./src/theme/CONTRAST_AUDIT.md). Six failing pairings fixed (`textMuted` light, `warn` on `warnSoft`, `borderStrong` light + dark for checkbox visibility, dark `danger` for overdue date, pinned-row checkbox border). All audited pairings now clear WCAG AA for text and 3:1 for non-text UI.
- [x] Add offline-safe persistence migration plan — see [`src/db/migrations/MIGRATIONS.md`](./src/db/migrations/MIGRATIONS.md). Covers when to add a migration, the safety rules (transaction-wrapped, idempotent, never-edit-shipped), the SQLite-specific rebuild dance for column type/constraint changes, the forward-only policy until Phase 14 backup/restore lands, and a testing checklist.
- [x] Add analytics — Mixpanel integration exists via [`src/lib/analytics.ts`](./src/lib/analytics.ts). Current events: `app_opened`, `onboarding_completed`, `task_created` / `task_edited` / `task_completed` / `task_uncompleted` / `task_deleted` (now including bounded task-content fields: title, notes, and up to 10 subtask titles), `category_created` / `category_deleted`, `notification_scheduled`, `theme_changed`, `custom_repeat_configured` (with `freq`, `interval_n`, `weekday_count`, `has_until`, `via`), `backup_exported` (with `size_bytes`), `backup_imported` (with `size_bytes`), `local_data_reset`. Privacy-policy and store disclosures must stay aligned with the shipped data collection.
- [x] Draft Play Store description, privacy policy starter, and release checklist — see [`STORE_COPY.md`](./STORE_COPY.md), [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md), and [`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md)
- [ ] Capture final Play Store screenshots from the release build
- [ ] Publish the privacy policy and complete the Play Console listing

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

> **Deferred.** Local-only persistence is sufficient for the current product loop; cloud sync would also be a prerequisite for collaboration (Phase 13), so both move together when revisited.

- [ ] Define canonical JSON export shape across all tables
- [x] Define canonical JSON export shape across all tables — see [`src/db/backup.ts`](./src/db/backup.ts) `backupJsonSchema` (`formatVersion`, `schemaVersion`, and active rows from categories / tasks / subtasks / reminders / repeat rules)
- [x] Implement local JSON export — Profile tab now generates a real `.json` backup file in app storage and opens the native share/save sheet via `expo-sharing`
- [x] Implement JSON import with version checks — Profile tab now opens the system file picker via `expo-document-picker`, validates the chosen JSON with Zod, and restores atomically inside one SQLite transaction; stale scheduled notification ids are dropped and re-armed after restore
- [x] Add backup/restore UI in the Profile tab — `Export backup` and `Import backup` rows under the new `Data` section
- [ ] Define server contract for cloud sync
- [ ] Implement cloud sync with last-write-wins or vector-clock strategy

### Phase 15: achievement badges

> Pure-JS gamification layer. Builds on existing `streakStats` data — no new schema, no new tables. The badges live on the Profile dashboard and surface via Mixpanel events when first unlocked, so we can see which milestones drive engagement.

- [ ] Define the badge catalogue (id, title, description, condition, icon). Suggested first set:
      - `first_completion` — completed your first task
      - `streak_7` / `streak_30` / `streak_100` — current streak hits N days
      - `tasks_50` / `tasks_500` — lifetime done count
      - `early_bird` — first task of the day completed before 9am, 10 days
      - `category_master` — used all three default categories at least once
      - `perfect_week` — a calendar week with zero missed days
- [ ] Build `src/lib/badges.ts` — pure function `computeUnlockedBadges(tasks): BadgeId[]`. No persistence; recompute every render. Cheap.
- [ ] Add `BadgeShelf` component on Profile (above or below the streak counter), shows unlocked badges in color, locked ones grayscale with a hint
- [ ] Track `badge_unlocked` analytics event the first time a badge flips unlocked. Persist a small `unlocked_badges_v1` SecureStore set so we only fire the event once per user.
- [ ] Optional: a "celebrate" toast when a new badge unlocks during a session (debounced; once per badge per session)

### Phase 16: home-screen widgets

> Native work; sized as **its own multi-day session**, not part of any V0 polish pass. Two implementation paths exist; pick one before starting.

- [ ] Decide implementation path:
      - **Native Kotlin widget** — write `AppWidgetProvider` + `RemoteViews` layout + `WidgetUpdateService` that reads the SQLite db directly. Updates are throttled by Android (≥ 30 min minimum cadence; tighter requires a foreground service). Most control, most maintenance burden.
      - **`expo-widgets`** — third-party Expo plugin. Faster to start, but maturity has been spotty across SDK upgrades. Worth a fresh evaluation when picking this up.
- [ ] Pick the widget surface area. Candidates ranked by complexity:
      - **Today list (read-only)** — easiest, just a list of titles + checkmarks. Tapping the widget opens the app. ~1 day.
      - **Streak counter** — single hero number, refreshed daily. Simplest of all. Mostly a glance widget.
      - **Quick-add** — hardest, requires a deeplink into the composer with a specific intent. Skip for V0 of widgets.
- [ ] Decide refresh cadence and how the widget reads the DB (WidgetUpdateService → expo-sqlite from the JS side via headless task, or duplicate the schema on the native side). The first option is simpler but slower; the second is faster but means the schema lives in two places.
- [ ] Hook widget refresh into existing `tasks-changed` event emission (so completing a task in the app updates the widget without waiting for the next throttled tick).
- [ ] Add Play Store listing assets that show the widget (only after it's real).

### Post-v1 Android advisories

> Captured from Play Console review for the SDK 35 release train. These are
> informational for V1 and should be revisited deliberately, not slipped into
> a reminder-fix release.

- [ ] Revisit Android 15 edge-to-edge deprecated API advisory on the next Expo / React Native upgrade. Current call sites flagged by Play are upstream (`StatusBarModule`, Material `BottomSheetDialog` / `EdgeToEdgeUtils` / `SheetDialog`), not custom native code in this repo.
- [ ] Revisit large-screen orientation support. The app currently declares `orientation: 'portrait'` in [`app.config.ts`](./app.config.ts), which generates `android:screenOrientation="portrait"` on `MainActivity`. Android 16 will ignore this on tablets/foldables, so proper support means testing and adapting layouts for landscape rather than relying on the lock.
- [ ] Ignore the ML Kit barcode scanner orientation advisory unless barcode scanning actually ships as a user-facing feature; the flagged `GmsBarcodeScanningDelegateActivity` is dependency-owned, not app-owned.

## Current implementation status

- [x] Expo app shell exists
- [x] Android local dev build path exists
- [x] Google sign-in wiring exists
- [x] Local reminders engine ships in production (`src/lib/notificationScheduler.ts`); the standalone dev test screen has been removed
- [x] Streak Todo branding is in place
- [x] Product task system is built
- [x] Calendar experience exists
- [x] Profile dashboard exists
- [ ] Collaboration features are intentionally deferred until the single-user product and sync are stable

## Public repo note

Follow [`REPO_HYGIENE.md`](./REPO_HYGIENE.md) before every push.
