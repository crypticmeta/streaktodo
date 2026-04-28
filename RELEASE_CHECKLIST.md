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
- [ ] Finalize short description
- [ ] Finalize full description
- [ ] Finalize category and tags in Play Console
- [ ] Verify support email in [`branding.js`](./branding.js)

## Legal and disclosure

- [x] Draft privacy policy in [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md)
- [ ] Publish privacy policy at the URL in [`branding.js`](./branding.js)
- [ ] Add terms page if you intend to show `termsUrl`
- [ ] Complete Play Store Data safety form
- [ ] Confirm Google sign-in disclosure matches runtime behavior
- [ ] Confirm Mixpanel collection is disclosed accurately

## App verification

- [ ] Rebuild release candidate
- [ ] Verify launcher icon on device
- [ ] Verify Google sign-in on fresh install
- [ ] Verify reminder permission flow
- [ ] Verify task create / edit / complete / delete
- [ ] Verify calendar and profile screens
- [ ] Verify analytics events arrive in Mixpanel

## Launch hygiene

- [ ] Run `npx tsc --noEmit`
- [ ] Review `REPO_HYGIENE.md`
- [ ] Confirm no logs, transcripts, or private notes are staged
- [ ] Confirm `.env` and local secrets are not tracked
- [ ] Tag the release commit when ready
