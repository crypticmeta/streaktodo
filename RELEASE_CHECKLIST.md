# Streak Todo Release Checklist

First public Android release checklist.

## Listing assets

- [ ] Capture at least 4 phone screenshots from the real app
- [ ] Use current production branding and launcher icon
- [ ] Show these screens:
  - [ ] Tasks home with real data
  - [ ] Composer / schedule flow
  - [ ] Calendar tab
  - [ ] Profile dashboard
- [ ] Export screenshots at Play Store supported dimensions
- [ ] Prepare feature graphic if needed later

## Store listing

- [x] Draft app title and descriptions in [`STORE_COPY.md`](./STORE_COPY.md)
- [x] Field-by-field paste-ready answers (listing + content rating + pricing) in [`PLAY_LISTING.md`](./PLAY_LISTING.md)
- [ ] Paste short description into Play Console
- [ ] Paste full description into Play Console
- [ ] Confirm category (Productivity) and tags in Play Console
- [x] Confirmed support email in [`branding.js`](./branding.js) is `ankitpathakofficial@gmail.com`

## Legal and disclosure

- [x] Draft privacy policy in [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md)
- [x] Privacy policy expanded to reflect the actual shipped Mixpanel event catalogue (16 events, identified-user profile fields, EU residency)
- [ ] Publish privacy policy at the URL in [`branding.js`](./branding.js) (`https://streaktodo.coderixx.com/privacy`)
- [ ] Add terms page if you intend to show `termsUrl`
- [x] Draft Play Store Data Safety answers in [`PLAY_DATA_SAFETY.md`](./PLAY_DATA_SAFETY.md)
- [ ] Submit Data Safety form in Play Console (paste from the draft)
- [x] Confirm Google sign-in disclosure matches runtime behavior — name, email, given/family name, avatar URL, Google account ID
- [x] Confirm Mixpanel collection is disclosed accurately — see PLAY_DATA_SAFETY.md and PRIVACY_POLICY.md

## Build & version

- [x] Bump `version` in [`app.config.ts`](./app.config.ts) to `1.0.0` (from `0.0.1`); native `versionCode` is owned by EAS via `eas.json`'s `appVersionSource: "remote"` + `production.autoIncrement: true`.
- [x] Keep `android/app/build.gradle`'s `versionName` aligned (`1.0.0`) so local builds don't drift from the published version string.
- [ ] Run an EAS production build: `eas build -p android --profile production`. Confirm the AAB is signed with the EAS-managed upload keystore.
- [ ] Upload the AAB to a **Closed Testing** track first (don't go straight to Production).

## App verification (on the closed-testing build)

- [ ] Verify launcher icon on device
- [ ] Verify Google sign-in on fresh install (clear app data first)
- [ ] Verify reminder permission flow (Android 13+ shows a runtime prompt)
- [ ] Verify task create / edit / complete / delete
- [ ] Verify custom repeat rules (every 2 weeks on Mon/Wed, with end date) round-trip correctly
- [ ] Verify backup export → import on a different device or after `Reset local data` works
- [ ] Verify calendar and profile screens
- [ ] Verify analytics events arrive in Mixpanel (EU project, look in Live View)

## Launch hygiene

- [ ] Run `npx tsc --noEmit`
- [ ] Review `REPO_HYGIENE.md`
- [ ] Confirm no logs, transcripts, or private notes are staged
- [ ] Confirm `.env` and local secrets are not tracked
- [ ] Tag the release commit when ready
