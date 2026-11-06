# Streak Todo Release Checklist

## Automated checks

- [ ] Run `npm ci`
- [ ] Run `npm run check`
- [ ] Run `npx expo export --platform android`
- [ ] Review `npm audit --omit=dev` without applying forced major upgrades

## Device verification

- [ ] Install a release build on a clean Android 13+ device
- [ ] Complete onboarding and confirm Tasks, Calendar, and Insights load
- [ ] Verify Google sign-in with the exact release/Play signing SHA, sign-out, cancellation, and local mode
- [ ] Create, edit, pin, complete, reopen, search, and delete a task
- [ ] Restore from Trash, then test permanent delete and Empty Trash
- [ ] Verify subtasks retain their IDs and completion states after editing
- [ ] Verify a two-week Mon/Wed recurrence and an end date
- [ ] Verify completing a recurring task creates exactly one next occurrence
- [ ] Verify notification permission denial, recovery, Done, and Snooze 10m
- [ ] Verify exact-alarm denial still saves a best-effort reminder
- [ ] Export a backup, reset local data, import it, and confirm reminders return
- [ ] Verify invalid, oversized, duplicate-ID, and broken-reference backups are rejected without partial restore
- [ ] Verify Mixpanel receives only the approved event schema; inspect properties for task text
- [ ] Turn analytics off before first initialization and after use; confirm new events stop
- [ ] Change timezone and verify calendar dates stay on the same human day
- [ ] Test light, dark, large-text, and TalkBack modes
- [ ] Check a narrow phone and tablet/landscape layout

## Privacy and store truth

- [ ] Confirm optional Google sign-in, Mixpanel, and manual backup match the privacy policy and Data Safety form
- [ ] Confirm automatic analytics capture/session replay, ads, remote push, and cloud task sync remain absent
- [ ] Confirm the production merged manifest has no broad storage permission
- [ ] Publish the current `privacy.html`
- [ ] Publish and test `delete-account.html`; monitor the deletion-request inbox
- [ ] Submit Data Safety answers from `PLAY_DATA_SAFETY.md`
- [ ] Capture fresh store screenshots from this exact release build
- [ ] Confirm all listing claims match current behavior

## Build and release

- [ ] Keep `app.config.ts` version and local native version name aligned
- [ ] Build the production AAB with EAS
- [ ] Confirm Play App Signing uses the production key, never the debug key
- [ ] Upload to Closed Testing first and review the pre-launch report
- [ ] Review staged files; exclude secrets, logs, and unrelated assets
- [ ] Tag only the validated release commit
