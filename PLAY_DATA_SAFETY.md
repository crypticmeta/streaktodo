# Play Console Data Safety form — draft answers

The Data Safety form is separate from the privacy policy URL. Both are
required for publication. Below are field-by-field answers derived from the
actual shipped build (Mixpanel + Google Sign-In + local SQLite). Re-verify
each row against `src/lib/analytics.ts`, `src/lib/auth.tsx`, and
`PRIVACY_POLICY.md` before submitting.

## Section 1 — Data collection and security

### Does your app collect or share any of the required user data types?

**Yes.** Email + name + profile photo URL are received via Google Sign-In
and forwarded to Mixpanel. Product interaction events are also sent to
Mixpanel.

### Is all of the user data collected by your app encrypted in transit?

**Yes.** All third-party traffic uses HTTPS:
- Mixpanel ingestion (`https://api-eu.mixpanel.com`)
- Google Sign-In (Google's SDK over TLS)

### Do you provide a way for users to request that their data be deleted?

**Yes.**
- In-app: the user can sign out (which calls `analytics.reset()` and
  detaches future events from their identity), and can use the
  "Reset local data" action on the Profile screen to wipe everything
  on-device.
- Out-of-app: contact `ankitpathakofficial@gmail.com` to request deletion
  of their Mixpanel profile.

## Section 2 — Data types collected

For each row: collected? shared? processed ephemerally? collection optional?
linked to user identity? used for which purposes?

### Personal info

| Type | Collected? | Shared? | Required? | Linked to user? | Purpose |
|---|---|---|---|---|---|
| **Name** | Yes | Yes (Mixpanel) | Optional | Yes | App functionality, Analytics |
| **Email address** | Yes | Yes (Mixpanel) | Optional | Yes | Account management, Analytics |
| **User ID** (Google account ID) | Yes | Yes (Mixpanel) | Optional | Yes | Account management, Analytics |
| **Other info** (avatar URL) | Yes | Yes (Mixpanel) | Optional | Yes | App functionality, Analytics |

> All four are "Optional" because the user can choose not to sign in. If the
> app gates usage behind sign-in in a future build, change "Optional" to
> "Required."

### Photos and videos

None.

### Audio files

None.

### Files and docs

| Type | Collected? | Shared? | Notes |
|---|---|---|---|
| **Files** (backup JSON read/written via DocumentPicker + Sharing) | **No** (processed entirely on-device) | No | The user picks a file or saves one; the app never uploads contents. Mixpanel receives only the byte size of exported/imported files. |

### Calendar / Contacts / Location / Web browsing / Search history / Installed apps

None of these.

### App activity

| Type | Collected? | Shared? | Required? | Linked to user? | Purpose |
|---|---|---|---|---|---|
| **App interactions** (Mixpanel events: app opens, task CRUD, category CRUD, theme/repeat/backup actions) | Yes | Yes (Mixpanel) | Required | Yes (when signed in) | Analytics, App functionality |

### App info and performance

| Type | Collected? | Shared? | Notes |
|---|---|---|---|
| **Crash logs** | No | — | We don't ship a crash reporter. If we add Sentry/Bugsnag later, declare them here. |
| **Diagnostics** | No | — | |
| **Other app performance data** | No | — | |

### Device or other identifiers

| Type | Collected? | Shared? | Notes |
|---|---|---|---|
| **Device or other IDs** | No | — | Mixpanel generates its own pseudo-anonymous device ID; this is the SDK's internal identifier and not a hardware ID. We do not collect Android Advertising ID, IMEI, or similar. |

### Health and fitness / Financial info / Messages / Audio recordings / Tasks (in the Data Safety sense)

> Note: Play's "App activity" → "Other user-generated content" *might* be
> claimed for the task titles you create. Our position is that task content
> stays on-device and is **not collected** in the Play sense — only event
> metadata is sent. If you ever ship cloud sync (Phase 14), this answer
> changes to "Yes, collected, linked, App functionality."

## Section 3 — Security practices

- Data encrypted in transit: **Yes**
- Users can request data deletion: **Yes** (see above)
- Independent security review: **No** (we have not commissioned one; only
  check this when there's a real audit certificate to attach)
- Committed to the Google Play Families Policy (children under 13)?
  **No** — the privacy policy explicitly states the app is not directed to
  children under 13, and we don't intentionally collect data from them.

## Section 4 — How third parties are handled

Mention the following SDKs and their roles in the Data Safety description
fields when prompted:

- **Mixpanel** — analytics. EU-region ingestion (`api-eu.mixpanel.com`).
  Receives event metadata + identified user profile when signed in.
- **Google Sign-In (`@react-native-google-signin/google-signin`)** — sign-in
  only. Token is stored locally in SecureStore; we do not call Google APIs
  beyond authentication.
- **expo-notifications** — local notification scheduling only. No remote
  push / FCM.
- **expo-secure-store** — local-only Android Keystore wrapper. No network.

## Section 5 — Pre-submission self-checks

- [ ] Confirmed all events in `src/lib/analytics.ts` are reflected in this
      doc and in `PRIVACY_POLICY.md`.
- [ ] Confirmed Google Sign-In profile fields in `AuthUser` match the
      "Personal info" rows here.
- [ ] Confirmed the privacy policy URL in `branding.privacyUrl` resolves
      and serves the latest `PRIVACY_POLICY.md` content.
- [ ] Confirmed Mixpanel project region. EU? US? IN? — must match the
      privacy policy.
- [ ] If a new event ships, update both files BEFORE the next release.
