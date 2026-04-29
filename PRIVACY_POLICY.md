# Streak Todo Privacy Policy

This is a starter draft, not final legal advice. Review it before publishing.

## Privacy Policy

Effective date: `2026-04-29` (last revised when exact-alarm permissions and task-content analytics were enabled)

Streak Todo ("we", "our", or "us") provides a mobile task planning and
scheduling application.

This Privacy Policy explains what information the app collects, how it is used,
and what choices users have.

## Information we collect

### Information you provide

If you sign in with Google, we may receive:

- your Google account email address
- your display name
- your first name and last name, when available
- your profile image URL, when available
- your Google account identifier

If you create tasks in the app, the app stores task-related content such as:

- task titles
- categories
- subtasks
- due dates and times
- reminder settings
- repeat settings

## Analytics and diagnostic data

We use Mixpanel to understand app usage and improve the product. Events are
sent from the app whenever you take one of the actions listed below.

Events currently tracked include:

- app opens (cold start, after sign-in)
- onboarding completion
- task creation, editing, completion, uncompletion, and deletion
- category creation and deletion
- reminder scheduling
- theme preference changes
- custom repeat-rule configuration (frequency, interval, weekday count, end-date presence)
- backup export, backup import, and local-data reset (file size only — never file contents)

For task-related analytics events, we also send limited task content to
Mixpanel so we can understand what kinds of work people use the app for.
That content may include:

- task titles
- task notes
- up to the first 10 subtask titles attached to the task

These fields are sent on task creation, editing, completion, uncompletion,
and deletion events. Long text is truncated before sending.

When you sign in with Google, the app also associates the following profile
information with your Mixpanel identity so analytics can be filtered by user:

- your Google account identifier
- your email, display name, given name, family name, and profile image URL when available
- the device platform (Android or iOS)
- the timestamp of when this Mixpanel identity was first seen

Task titles, notes, and a limited number of subtask titles may be sent to
Mixpanel as described above. Backup file contents are never sent to
Mixpanel. Some analytics events also include small metadata such as boolean
composition flags ("had a due date", "had a reminder", etc.) and counts
(interval N, weekday count, byte size).

## How we use information

We use information to:

- provide sign-in and account functionality
- save and organize your tasks
- schedule reminders you request
- measure feature usage and improve the app
- monitor product quality and release health

## Data sharing

We do not sell personal information.

We share limited data with service providers that help operate the app, such as:

- Google, for authentication
- Mixpanel, for analytics

These providers process data under their own terms and privacy policies.

## Data storage

Task data is primarily stored locally on your device in the current version of
the app.

Authentication tokens and certain local preferences may be stored using secure
device storage where supported.

## Data retention

We retain analytics and account-related data only as long as reasonably needed
for product operations, security, support, and legal compliance.

Local task data remains on your device until you delete it or uninstall the app,
subject to platform backup behavior.

## Your choices

You can:

- choose whether to sign in with Google
- delete tasks inside the app
- sign out of your account (this stops new analytics events from being attached to your identity)
- use the "Reset local data" action on the Profile screen to wipe all local
  tasks, categories, reminders, repeat rules, and subtasks from this device
- uninstall the app

### Deleting analytics data already collected

Sign-out and uninstalling stop *future* events from being recorded against
you, but they do not retroactively remove events already sent to Mixpanel.
The app does not currently provide an in-app self-serve flow to delete
already-collected analytics data.

To request deletion of the analytics profile and historical events
associated with your Google account identifier, email
`ankitpathakofficial@gmail.com` with the subject line "Delete my analytics
data" and the email address you signed in with. We process these requests
manually via Mixpanel's GDPR data-deletion API and will confirm completion
within 30 days, in line with applicable data-protection law.

## Permissions used by the app

The Android app declares the following permissions:

- **POST_NOTIFICATIONS** — to display reminder notifications you set inside the app.
- **SCHEDULE_EXACT_ALARM** — to deliver reminder notifications at the
  user-set time without being delayed by Android's battery-saver
  batching. Auto-granted on install for productivity / calendar apps;
  revocable in system settings, in which case reminders fall back to
  inexact delivery (still functional, but may be delayed by several
  minutes).
- **RECEIVE_BOOT_COMPLETED** — to re-arm any pending reminders after the
  device restarts. Without this, scheduled reminders would not survive
  a reboot.
- **WAKE_LOCK** — used by the notification system to wake the device
  when an exact reminder fires. We do not hold wake locks for any other
  purpose.

We do not use any other Android runtime permissions.

## Children's privacy

Streak Todo is not directed to children under 13, and we do not knowingly
collect personal information from children under 13.

## Security

We use reasonable measures designed to protect information, but no method of
storage or transmission is completely secure.

## International processing

Your information may be processed in countries other than your own, depending on
the service providers used to operate the app.

## Changes to this policy

We may update this Privacy Policy from time to time. If we make material
changes, we will revise the effective date above.

## Contact

If you have questions about this Privacy Policy, contact:

ankitpathakofficial@gmail.com

## Pre-publish review checklist

- Confirm the contact email is correct
- Confirm Mixpanel region and retention settings
- Confirm the policy matches the actual shipped build
- Publish this document at `https://streaktodo.coderixx.com/privacy`
