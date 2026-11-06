# Streak Todo Privacy Policy

Effective date: `2026-08-11`

Streak Todo is a local-first task planner published by CODERIXX. This policy
describes the current mobile build.

## Task data stays local

Tasks, notes, subtasks, category names, dates, reminder text, repeat rules,
completion history, and local preferences are stored in the app sandbox on
your device. Streak Todo does not provide cloud task sync and does not upload
this content to CODERIXX, Google, or Mixpanel.

Recently deleted tasks remain in the in-app Trash until you restore them,
delete them permanently, empty Trash, reset local data, or uninstall the app.
Android device backup may preserve eligible app data according to your device
and Google backup settings.

## Optional Google sign-in

You may connect a Google account or continue locally without an account. When
you choose Google sign-in, Google provides a Google account identifier, email
address, display name, and other basic profile fields made available by the
Google sign-in SDK. Streak Todo uses the identifier, email, and display name to
show the connected account and identify that signed-in user in Mixpanel.

Streak Todo does not store your Google password, request offline access, store
an ID token in its own preferences, or upload task data to a CODERIXX account
server. Google processes the sign-in flow under Google's own terms and privacy
policy.

## Product analytics

Mixpanel product analytics is enabled by default and can be turned off at any
time under **Insights → Privacy → Share product usage**. The app disables
automatic event capture and session replay and sends only explicitly defined
events, such as app opens, sign-in or local-mode selection, onboarding
completion, successful task/category actions, reminder scheduling, theme
changes, and backup/reset actions.

Event properties are limited to coarse product context such as the source
screen, whether a task has a due date, time, notes, category, reminder, or
repeat rule, a bounded subtask count, recurrence shape, and backup file size.
Streak Todo does **not** send task titles, notes, subtask text, category names,
reminder text, search terms, or backup contents to Mixpanel.

Mixpanel may also process standard SDK and device context, including an
SDK-generated identifier, app and OS versions, device/platform information,
and the IP address used to make the network request. IP-based geolocation
enrichment is disabled. Signed-in Mixpanel profiles include the Google account
identifier, email address, and display name. The app uses Mixpanel's EU
ingestion endpoint. Turning analytics off stops new app analytics events; data
already sent is handled under the retention and deletion controls below.

Streak Todo has no advertising SDK, ad tracking, session replay, crash-reporting
SDK, or remote push service.

## Manual backups and external links

Backup export creates a JSON file and opens your device's standard share
sheet. Backup import reads only the file you select. Streak Todo does not
upload either file. Copies you save or send are controlled by you and by the
destination you choose.

External links open in your system browser, where the destination site's own
privacy practices apply.

## Service providers and sharing

Streak Todo uses Google for optional authentication and Mixpanel as a product
analytics service provider. Data is not sold and is not used for third-party
advertising. Network data is transmitted over HTTPS. Service-provider handling
is also governed by their applicable terms and privacy documentation.

## Retention and deletion

- Delete individual tasks, restore or permanently remove Trash items, or use
  **Insights → Data → Reset local data** to erase the local database.
- Use **Sign out** to disconnect the Google session from Streak Todo. Signing
  out does not delete your Google account or analytics data already received.
- Turn off **Share product usage** to stop new Mixpanel events from the app.
- Use [the Streak Todo deletion page](https://streaktodo.coderixx.com/delete-account)
  or email `ankitpathakofficial@gmail.com` to request deletion of the Mixpanel
  profile and associated analytics records. Include the email address used for
  Google sign-in so the request can be matched. We may ask you to verify the
  request before processing it.
- You can separately remove Streak Todo's access from your Google Account
  settings. CODERIXX cannot delete your Google account.

Exported JSON backups remain wherever you saved or sent them and must be
deleted from those destinations separately.

## Android permissions

- `INTERNET` supports Google sign-in and Mixpanel analytics.
- `POST_NOTIFICATIONS` displays reminders you choose to create.
- `SCHEDULE_EXACT_ALARM` lets you opt in to more precise reminder delivery on
  supported Android versions; reminders remain best effort when denied.
- `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, and `VIBRATE` support local reminder
  delivery and recovery.

The app uses the system document picker and share sheet instead of broad photo,
media, or file-storage access.

## Security and children

Platform sandboxing and protected preference storage help secure local data,
and service-provider traffic uses HTTPS, but no method is completely risk-free.
Streak Todo is not directed to children under 13, and we do not knowingly
collect personal information from children.

## Changes and contact

Material changes will update the effective date above. Questions or deletion
requests can be sent to `ankitpathakofficial@gmail.com`.

Before publishing a release, verify this policy against the dependency list,
merged Android manifest, analytics event schema, and shipped runtime behavior.
