// Single source of truth for brand-level strings.
// Change values here and they flow into native config (app.config.ts) AND runtime code.
// Plain JS (not TS) so Expo's config loader can require() this synchronously at build time.

const branding = {
  // Display
  appName: 'Streak Todo',
  tagline: 'Stay on streak. Get things done.',

  // Identity
  appSlug: 'streaktodo',
  scheme: 'streaktodo',
  bundleId: 'com.streaktodo.app',
  androidPackage: 'com.streaktodo.app',

  // Brand color used by native plugins (notifications icon tint, splash, etc).
  // This is a NATIVE-ONLY value. UI colors live in src/theme/tokens.ts.
  primaryColor: '#1f2328',
  backgroundColor: '#1f2328',

  // Contact / legal — fill in before public launch.
  supportEmail: 'support@streaktodo.app',
  privacyUrl: 'https://streaktodo.app/privacy',
  termsUrl: 'https://streaktodo.app/terms',

  // Store presence (placeholders until first publish).
  playStoreUrl: '',
  appStoreUrl: '',

  // Social handles (placeholders).
  twitter: '',
  instagram: '',

  // Google iOS OAuth client URL scheme. The Google Sign-In plugin validates this
  // at config time even on Android-only builds, so a placeholder ships by default.
  // Format: com.googleusercontent.apps.<id> (the reversed iOS client ID — NOT the app scheme).
  // Override via env BEFORE building for iOS:
  //   EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.<your-ios-client-id>
  googleIosUrlScheme:
    process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ||
    'com.googleusercontent.apps.placeholder-set-before-ios-build',

  // Mixpanel project token. Public-by-design (it identifies the destination
  // project; it does NOT grant write access beyond ingest). Override via env
  // for staging/test projects:
  //   EXPO_PUBLIC_MIXPANEL_TOKEN=<your-token>
  mixpanelToken:
    process.env.EXPO_PUBLIC_MIXPANEL_TOKEN ||
    'fbdf4b658ace1e0d297d30b78121dcf3',
};

module.exports = { branding };
