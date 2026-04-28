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
  userInterfaceStyle: 'light',
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
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon-foreground.png',
      backgroundColor: branding.backgroundColor,
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
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
