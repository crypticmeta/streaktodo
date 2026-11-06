import type { ExpoConfig } from 'expo/config';
import { branding } from './branding';

const config: ExpoConfig = {
  name: branding.appName,
  slug: branding.appSlug,
  scheme: branding.scheme,
  // User-facing app version. Bump for every Play Store release. Native
  // versionCode is managed by EAS (`appVersionSource: 'remote'` +
  // `autoIncrement: true` in eas.json), so we only edit this string here.
  // Semver-ish: 1.x.x is the public-launch family; bump minor for new
  // features, patch for fixes.
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // Let the native splash/system chrome follow the in-app light/dark choice.
  // Forcing light here produced bright system bars around the dark theme.
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: branding.backgroundColor,
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: branding.bundleId,
  },
  android: {
    package: branding.androidPackage,
    // Transitive native modules advertise these optional capabilities, but
    // this app only uses private app storage and non-biometric preferences.
    // Mirror the checked-in manifest removals for a future clean prebuild.
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.USE_BIOMETRIC',
      'android.permission.USE_FINGERPRINT',
    ],
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon-foreground.png',
      backgroundColor: branding.backgroundColor,
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    // NOTE: this `permissions` array is effectively dead config in our
    // current layout. `android/` is checked into the repo (we keep it
    // versioned so dev builds work without an EAS roundtrip), and Expo's
    // prebuild treats the existing `android/app/src/main/AndroidManifest.xml`
    // as the source of truth — it does NOT merge this list into a
    // pre-existing manifest. The actual permissions live in that XML file.
    // Mirrored here so that `npx expo prebuild --clean` (which would
    // regenerate the native folder from this config) produces a manifest
    // with the same set.
    //
    // SCHEDULE_EXACT_ALARM lets users opt in to precise delivery on Android
    // versions that gate exact alarms. Reminders continue with best-effort
    // delivery when the permission is unavailable or denied.
    permissions: [
      'SCHEDULE_EXACT_ALARM',
      'POST_NOTIFICATIONS',
      'RECEIVE_BOOT_COMPLETED',
      'WAKE_LOCK',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-notifications',
      {
        color: branding.primaryColor,
      },
    ],
    [
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: branding.googleIosUrlScheme },
    ],
    'expo-secure-store',
    '@react-native-community/datetimepicker',
  ],
  experiments: {
    typedRoutes: true,
  },
  // EAS link. The project ID was generated when `eas-cli` first ran
  // against this app slug. Don't edit this — it's the durable identifier
  // EAS uses for builds, credentials, and version state, and changing it
  // would orphan the upload keystore + version history.
  extra: {
    eas: {
      projectId: '71e1ed77-5a8e-4d70-9366-95258e11a124',
    },
  },
};

export default config;
