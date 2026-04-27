// Single source of truth for brand-level strings.
// Change appName here and it flows into native config (app.config.ts) and JS code.
// The product name is intentionally a placeholder — final name TBD.

const branding = {
  appName: 'Streak Todo',
  appSlug: 'streaktodo',
  scheme: 'streaktodo',
  bundleId: 'com.streaktodo.app',
  androidPackage: 'com.streaktodo.app',
  primaryColor: '#0a0a0a',
  backgroundColor: '#ffffff',
  // Google iOS OAuth client URL scheme. The Google Sign-In plugin validates this
  // at config time even on Android-only builds, so a placeholder ships by default.
  // Format: com.googleusercontent.apps.<id> (the reversed iOS client ID — NOT the app scheme).
  // Override via env BEFORE building for iOS:
  //   EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.<your-ios-client-id>
  googleIosUrlScheme:
    process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ||
    'com.googleusercontent.apps.placeholder-set-before-ios-build',
};

module.exports = { branding };
