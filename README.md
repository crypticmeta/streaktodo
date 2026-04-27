# Streak Todo (Expo + TypeScript)

Simple todo + scheduler app with notifications and streaks.

## What's in V0

- **Sign-in screen** — Google Sign-In via `@react-native-google-signin/google-signin`. Returns an ID token your Next.js backend will verify later.
- **Notifications screen** — gated behind sign-in. Two buttons:
  - **Fire now** — schedules an immediate local notification
  - **Fire in 5s** — schedules a notification 5 seconds out (lock the phone or background the app to verify it still fires)

Google Sign-In requires a **development build**. Expo Go cannot load native modules.

## Local Android workflow

You have `android/` checked in, so the dev client builds locally and installs over USB. After the first build, day-to-day iteration is `npx expo start` with Fast Refresh — same as Expo Go.

### One-time: get the SHA-1 fingerprint

```bash
keytool -list -v -keystore ./android/app/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android | grep SHA1
```

This is the keystore that signs the APK installed on your phone — register **this** SHA-1 in Google Cloud Console, not `~/.android/debug.keystore`.

### One-time: create an Android OAuth client in Google Cloud Console

In [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials):

1. **+ CREATE CREDENTIALS → OAuth client ID**
2. Application type: **Android**
3. Package name: `com.streaktodo.app`
4. SHA-1 certificate fingerprint: paste the value from the command above
5. Save

You don't need to copy the Android client ID anywhere — Google ties it to your Cloud project automatically. The app uses your **Web** client ID (in `.env`) as `webClientId` so the returned ID token has the Web client as its audience for backend verification.

### One-time: connect your phone

Enable USB debugging on the phone, plug in, then:

```bash
adb devices
```

### Build and run

From `apps/streaktodo/`:

```bash
npx expo run:android
```

This compiles the dev client, installs the APK on your phone, and starts Metro. After the first build, the binary stays on your phone — subsequent code changes only need:

```bash
npx expo start
```

…then shake the phone or press `R` to reload.

## When native config changes

Edits to `app.config.ts`, plugin lists, or anything that affects the native project require a rebuild:

```bash
npx expo prebuild --clean   # regenerate android/ from app.config.ts
npx expo run:android
```

JS/TS-only changes never need a rebuild — Metro hot-reloads them.

## Brand placeholder

App name and package identifiers live in [`branding.js`](./branding.js). Both `app.config.ts` and runtime code read from there. Rename once, rebuild native.

## Env vars

`.env` (loaded automatically by Expo when starting Metro):

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-client-id>
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.<ios-client-id>   # required before iOS builds
```

The Web client ID is the audience your Next.js backend will verify the ID token against. The Google client SECRET stays on the server only — never in the mobile bundle.

## Repo hygiene

Public-repo guardrails live in [`REPO_HYGIENE.md`](./REPO_HYGIENE.md). Follow that before every push.

## Layout

```
apps/streaktodo/
├── App.tsx                          ← thin auth router
├── app.config.ts                    ← dynamic Expo config (reads branding.js + env)
├── branding.js                      ← single source of truth for app name / IDs
├── eas.json                         ← EAS Build profiles (used later for store builds)
├── android/                         ← native project (kept for local USB builds)
├── src/
│   ├── lib/
│   │   └── auth.tsx                 ← AuthProvider + useAuth (Google Sign-In + secure storage)
│   ├── screens/
│   │   ├── SignInScreen.tsx
│   │   └── NotificationsScreen.tsx
│   └── theme/
│       └── colors.ts
```

## iOS later

When you're ready for iOS, use EAS Build's macOS workers — `eas build --profile development --platform ios`. The same `branding.js` + `app.config.ts` produces the iOS bundle.

## Notes

- SDK 54, expo-notifications 0.32, @react-native-google-signin/google-signin 16, new architecture enabled
- `android/` is checked in. Don't hand-edit `build.gradle`; change `app.config.ts` and run `npx expo prebuild --clean` to regenerate.
- The Google Sign-In plugin requires `iosUrlScheme` even on Android-only builds — a placeholder ships in `branding.js`.
