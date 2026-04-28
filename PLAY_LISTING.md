# Play Console store listing — paste-ready fields

Copy/paste targets for Play Console's "Main store listing" + "App content"
flow. All values reflect the actual shipped build. Re-verify against
`branding.js`, `STORE_COPY.md`, and `PRIVACY_POLICY.md` before submitting.

---

## Store listing → Main store listing

### App name (max 30 chars)

```
Streak Todo
```

### Short description (max 80 chars)

```
To-do list with reminders, calendar, and an honest streak counter.
```

### Full description (max 4000 chars)

```
Streak Todo is a free local-first to-do list app for Android. Plan daily tasks, set reminders, and track your streak without paywalls, ads, or forced sign-in.

Capture tasks fast from a floating action button, organize them into categories with color tags, set reminders, and repeat important routines with a real custom rule editor for schedules like every 2 weeks on Mon/Wed or weekdays only. See what's due today, what's coming up, and what needs attention next.

What's inside

- Quick task capture from anywhere in the app
- Default categories for Work, Personal, and Wishlist, plus your own custom categories with color tags
- Subtasks for breaking large tasks into smaller steps
- Due dates, times, reminders, and repeat rules (daily, weekly, monthly, yearly, and a real Custom rule editor for things like "every 2 weeks on Mon/Wed, until June")
- A calendar view that highlights days with tasks and lets you scrub through history or upcoming weeks
- An honest streak counter that doesn't fake-encourage you on missed days
- Light, dark, and system-matched themes
- Local-first storage on your device, with backup export and import via standard file sharing
- Notes on every task

What it leaves out, on purpose

- No paywalls or upgrade banners. Everything in the app is free.
- No forced collaboration or feed. It's a personal planner first.
- No attachments or media uploads. Tasks stay text-only and quick.

Built for solo creators, students, and anyone who wants the planner to fit the day instead of running it. Add structure, keep important habits visible, and finish more without turning your todo list into a second job.

Made by CODERIXX (coderixx.com).
```

> Character budget: ~1450 used of 4000. Room to add a "What's new" line for
> future releases without trimming.

### App category

- **Application category:** Productivity
- **Tags** (Play Console picks from a predefined list; choose any that apply,
  max 5):
  - To-do list
  - Reminders
  - Calendar
  - Habit tracker
  - Personal organizer

### Contact details

- Website: `https://coderixx.com`
- Email: `ankitpathakofficial@gmail.com`
- Phone: leave blank unless you genuinely want it on the listing
- Privacy policy: `https://streaktodo.coderixx.com/privacy`

---

## Store listing → Graphics

| Asset | Spec | File |
|---|---|---|
| App icon | 512×512 PNG, 32-bit, no alpha for the upload (Play Console renders its own square mask) | `assets/store/playstore-icon-512.png` |
| Feature graphic | 1024×500 PNG/JPG | `assets/store/feature-graphic-1024x500.png` |
| Phone screenshots (min 2, max 8) | 16:9 to 9:16, 320–3840px per side | `assets/store/homescreen_store.png`, `task_input_store.png`, `task_datepicker_store.png`, `calendar_screen_store.png`, `profile_screen_store.png` |
| 7-inch tablet screenshots | optional; skip for V1 (we don't market for tablets) | — |
| 10-inch tablet screenshots | optional; skip for V1 | — |
| Promo video | optional; skip for V1 | — |

> Play Console rejects icons with transparency in some flows. If yours is
> rejected, flatten the alpha against your brand cream (`#f4efe6`) and
> re-upload.

### Suggested screenshot order

1. `homescreen_store.png` — leads with the core surface so reviewers immediately see the product loop
2. `task_input_store.png` — shows quick capture
3. `task_datepicker_store.png` — shows scheduling depth (the "real Custom repeat" claim is most credible right after this)
4. `calendar_screen_store.png` — second-screen breadth
5. `profile_screen_store.png` — streak proof + dashboard

---

## App content section

### Privacy policy

- URL: `https://streaktodo.coderixx.com/privacy`
- Confirm fetch returns 200 + plain HTML/markdown before submitting.

### App access

> "Is part of your app restricted, e.g. behind a login?"

**No.** Sign-in is offered (Google) but every screen of the app is reachable
without an account. If we ever gate features behind login, change this and
provide a test account.

### Ads

> "Does your app contain ads?"

**No.**

### Content rating

The content rating questionnaire produces an IARC rating. Your honest
answers for this build:

- Violence: **No**
- Sexuality / nudity: **No**
- Profanity / crude humor: **No**
- Controlled substances (drugs, alcohol, tobacco): **No**
- Gambling: **No**
- Horror / fear-inducing content: **No**
- User-generated content shared between users: **No** — task data stays
  local; no social or sharing surface
- Location sharing: **No**
- Personal info sharing between users: **No**
- Digital purchases: **No**
- Unrestricted internet: **No** — no embedded browser or web view

Expected rating: **Everyone (PEGI 3, IARC 3+).**

### Target audience and content

- Target age groups: **18 and over** (safest option for a productivity tool;
  picking 13+ would force you into Designed-for-Families compliance, which
  has stricter ad/SDK rules and isn't a fit for a Mixpanel-using app)
- Does the app appeal to children? **No**

### News app

> "Is your app a news app?"

**No.**

### Health app

> "Does your app collect or share health data?"

**No.** Streak data is task completion, not biometric / fitness / health.

### COVID-19 contact tracing & status

**No.**

### Data safety

See `PLAY_DATA_SAFETY.md` for the complete field-by-field draft.

### Government app

**No.**

### Financial features

**No.**

### Social features

**No.**

---

## Pricing & distribution

- **Free** (paid apps require additional tax setup and aren't aligned with
  your scope guardrails — "no paywalls, all features free")
- **Countries:** all available, *unless* you have a reason to exclude one.
  No good reason exists right now.
- **Contains ads:** **No**
- **In-app purchases:** **No**
- **Designed for Families program:** **No**

---

## Pre-launch reports

Play Console offers a free pre-launch test on a small device farm when you
upload to any track (Internal / Closed / Open / Production). Crash reports
and lint findings show up under "App content → Pre-launch reports."
Don't skip this — it caught a real OEM-specific bug for me on a previous
project.

---

## Submission flow (after identity verification clears)

1. **Create app** — name "Streak Todo", default language English (US),
   category Productivity, **Free**, accept declarations.
2. **Set up store listing** — paste from above.
3. **Upload screenshots, icon, feature graphic** — from `assets/store/`.
4. **Fill App content** — privacy policy URL, content rating questionnaire,
   target audience, ads (no), data safety (paste from `PLAY_DATA_SAFETY.md`).
5. **Pricing & distribution** — free, all countries.
6. **Create a release on the Closed Testing track** — upload the AAB from
   EAS Build. Add yourself as a tester.
7. **Wait for the pre-launch report** (typically <1 hour).
8. **Promote to Production** when the build looks clean and you've eaten
   your own dogfood for a few days.
```
