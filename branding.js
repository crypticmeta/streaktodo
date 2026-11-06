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
  primaryColor: '#1d6d55',
  backgroundColor: '#fff7e6',

  // Contact / legal — fill in before public launch.
  supportEmail: 'ankitpathakofficial@gmail.com',
  privacyUrl: 'https://streaktodo.coderixx.com/privacy',
  deletionUrl: 'https://streaktodo.coderixx.com/delete-account',
  termsUrl: 'https://streaktodo.coderixx.com/terms',

  // Store presence (placeholders until first publish).
  playStoreUrl: '',
  appStoreUrl: '',

  // Social handles (placeholders).
  twitter: '',
  instagram: '',

  // Google iOS OAuth client URL scheme. Android uses the public web client ID
  // from EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID; this reversed iOS id is required by
  // the native config plugin when an iOS build is generated.
  googleIosUrlScheme:
    process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ||
    'com.googleusercontent.apps.placeholder-set-before-ios-build',

  // Mixpanel project tokens are public ingest identifiers, not API secrets.
  // Override this for staging so development events do not pollute production.
  mixpanelToken:
    process.env.EXPO_PUBLIC_MIXPANEL_TOKEN ||
    'fbdf4b658ace1e0d297d30b78121dcf3',
};

module.exports = { branding };
