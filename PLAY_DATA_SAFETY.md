# Play Console Data Safety — current build

Last checked: `2026-08-11`

This is a conservative, implementation-backed draft for the current Android
build. Confirm the final answers in Play Console against every active artifact
and the current Mixpanel/Google SDK disclosures before submission.

## Top-level answers

- **Does the app collect any required data types?** Yes.
- **Does the app share data under Google Play's Data Safety definition?** No,
  assuming Google and Mixpanel are used under qualifying service-provider
  terms. They still receive data as described in the privacy policy.
- **Is data encrypted in transit?** Yes, for app-managed network traffic
  (HTTPS).
- **Can users request deletion?** Yes. In-app path:
  **Insights → Privacy → Delete account data**. External URL:
  `https://streaktodo.coderixx.com/delete-account`.
- **Is all task content optional/local?** Task content is processed on device
  and is not collected by the developer.

## Data types to declare

| Play data type | Collected | Required? | Purpose | Notes |
|---|---:|---|---|---|
| Personal info → Name | Yes | Optional | Account management; analytics | Only after optional Google sign-in; sent to Mixpanel profile |
| Personal info → Email address | Yes | Optional | Account management; analytics | Only after optional Google sign-in; sent to Mixpanel profile |
| Personal info → User IDs | Yes | Optional | Account management; analytics | Google account ID for signed-in users; Mixpanel distinct/device IDs |
| App activity → App interactions | Yes | Optional | Analytics | Explicit successful product actions and app opens; users can opt out |
| App activity → Other actions | Yes | Optional | Analytics | Coarse task shape, recurrence configuration, backup/reset actions |
| Device or other IDs | Yes | Optional | Analytics | Mixpanel SDK-generated identifier; not used for advertising |

For every collected type above:

- **Ephemeral?** No; Mixpanel persists analytics records according to project
  retention settings.
- **Processed off device?** Yes.
- **User can opt out?** Yes. Google sign-in is optional, and Mixpanel tracking
  can be disabled from Insights. Because every user can continue locally and
  disable analytics, these data types are classified as optional.
- **Sold or used for ads?** No.

## Data not collected by the developer

- Task titles, notes, subtask text, category names, reminder text, search terms,
  and JSON backup contents
- Precise or approximate location as an analytics property; IP geolocation
  enrichment is disabled (ordinary HTTPS requests still expose an IP address
  to the receiving service)
- Contacts, device calendar, photos, videos, audio, messages, or broad files
- Financial, payment, health, fitness, or government-identification data
- Crash logs or performance diagnostics through a crash-reporting SDK
- Advertising ID or ad-personalization data

Backup export/import is user-directed on-device processing. The app creates or
reads the selected JSON file locally and does not upload it.

## Account and deletion handling

Google sign-in is optional and does not create cloud task storage, but this
release should be treated as account-capable for conservative Play compliance.
The app therefore exposes both in-app and web deletion paths. The deletion page
explains local deletion, Google disconnection, analytics opt-out, and how to
request deletion of associated Mixpanel records.

## SDK/runtime notes

- `@react-native-google-signin/google-signin`: optional Google identity flow
- `mixpanel-react-native`: manual analytics events; automatic events and
  session replay off; EU endpoint; IP geolocation enrichment off
- `expo-sqlite`: on-device task database
- `expo-secure-store`: local auth mode, analytics preference, onboarding, and
  theme-related preferences
- `expo-notifications`: scheduled local notifications; no remote push product
- `expo-document-picker`, `expo-file-system`, `expo-sharing`: user-directed
  local backup import/export

## Pre-submission checks

- [ ] Inspect the production merged manifest and dependency graph
- [ ] Confirm automatic Mixpanel capture/session replay remain disabled
- [ ] Inspect every event property and confirm no user-entered task text
- [ ] Test analytics opt-out before initialization and after initialization
- [ ] Test Google sign-in, sign-out, and local mode with the Play signing SHA
- [ ] Verify the hosted privacy and deletion pages return 200
- [ ] Confirm the deletion request process is monitored and operational
- [ ] Reconcile these answers with all active Play artifacts, not only this APK
- [ ] Test a clean production release on a physical device
