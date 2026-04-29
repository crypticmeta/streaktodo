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

**Yes — but with an honest caveat about scope.**

- **On-device data (full self-serve):** the "Reset local data" action on
  the Profile screen wipes all local tasks, categories, reminders, repeat
  rules, and subtasks. Sign-out clears authentication state and detaches
  future analytics events from the user's identity (`analytics.reset()`).
  Uninstalling the app removes everything else on-device.

- **Analytics data already collected (request-only, manual):** the app
  does not currently provide an in-app self-serve flow to delete
  already-recorded Mixpanel events. Users email
  `ankitpathakofficial@gmail.com` and we manually delete their analytics
  profile via Mixpanel's GDPR data-deletion API within 30 days. The
  privacy policy spells out the request flow (subject line + signed-in
  email).

If Play asks specifically about an "in-app deletion option" toggle: answer
**Yes** for on-device data, and indicate that analytics deletion is via
contact (this is what most privacy-policy-only apps answer; Play accepts
both routes as long as the policy is explicit).

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

## Appendix — Filling the form via CSV import

Play Console offers an Export / Import button on the Data Safety section.
The Console UI for "Data usage and handling" is misleading: each declared
data type's "Is this data collected, shared, or both?" question is rendered
as a single radio with options Collected / Shared, with no "Both" option.
Selecting "Collected" silently omits the sharing declaration, which produces
a false "No data shared with third parties" preview even when Mixpanel +
Google Sign-In are clearly shipped.

The reliable workaround:

1. Fill the form in the UI as best you can, then click **Export** at the
   top of the Data Safety screen. Save to `~/Downloads/data_safety_export.csv`.
2. Run `tools/fix_data_safety.py` (or the inline equivalent in tmp) which
   patches every declared data type's row to set:
   - `PSL_DATA_USAGE_ONLY_COLLECTED` = `true`
   - `PSL_DATA_USAGE_ONLY_SHARED`    = `true`   (the missing one)
   - `PSL_DATA_USAGE_EPHEMERAL`       = `false` (literal string; empty = "unanswered" and import is rejected)
   - `USER_CONTROL_OPTIONAL`          = `true`  for Personal info (guest mode is the bypass)
   - `USER_CONTROL_REQUIRED`          = `true`  for App activity (no in-app analytics toggle)
   - Both `DATA_USAGE_COLLECTION_PURPOSE` and `DATA_USAGE_SHARING_PURPOSE`
     have `PSL_APP_FUNCTIONALITY` and `PSL_ANALYTICS` set to `true`; everything
     else stays empty.
3. Upload `data_safety_fixed.csv` via the **Import** button on the same
   screen.
4. Click into Step 5 (Preview) to verify the public summary now lists
   collected + shared data types and has the encryption-in-transit line.

For Streak Todo's V1 build the five declared types are:
`PSL_NAME`, `PSL_EMAIL`, `PSL_USER_ACCOUNT`, `PSL_OTHER_PERSONAL`,
`PSL_USER_INTERACTION`. Re-export and re-run the fixer if the data
catalogue ever expands (e.g., new Mixpanel events that touch new data
categories — backup file *contents* would, byte-size only does not).
