import type { ExpoConfig } from 'expo/config';
import { branding } from './branding';

const config: ExpoConfig = {
  name: branding.appName,
  slug: branding.appSlug,
  scheme: branding.scheme,
  version: '0.0.1',
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
      foregroundImage: './assets/adaptive-icon.png',
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
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
