import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import {
  GoogleSignin,
  statusCodes,
  type User,
} from '@react-native-google-signin/google-signin';
import * as analytics from './analytics';

const ID_TOKEN_KEY = 'google_id_token';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

if (!WEB_CLIENT_ID) {
  console.warn('[GoogleSignIn] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set in the bundle');
} else {
  console.log('[GoogleSignIn] webClientId present, suffix:', WEB_CLIENT_ID.slice(-12));
}

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  photo: string | null;
};

type AuthState =
  | { status: 'loading' }
  | { status: 'unsupported'; reason: string }
  | { status: 'signed-out'; error: string | null }
  // Guest mode: the user explicitly chose "Continue without signing in" on
  // the sign-in screen. The app is fully usable (it's local-first), but no
  // Google profile is attached and analytics events run against an
  // anonymous Mixpanel distinct_id. Mainly exists so Play Store reviewers
  // (who can't sign into a third-party Google account) can review every
  // screen of the app.
  | { status: 'guest' }
  | { status: 'signed-in'; user: AuthUser; idToken: string | null };

const GUEST_PREF_KEY = 'auth_guest_v1';

type AuthContextValue = {
  state: AuthState;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Skip Google Sign-In and use the app as an anonymous local-only user. */
  continueAsGuest: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function toAuthUser(u: User): AuthUser {
  return {
    id: u.user.id,
    email: u.user.email,
    name: u.user.name,
    givenName: u.user.givenName,
    familyName: u.user.familyName,
    photo: u.user.photo,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    if (isExpoGo) {
      setState({
        status: 'unsupported',
        reason:
          'Google sign-in needs a development build. Expo Go cannot load native modules. Build with EAS and install the dev APK.',
      });
      return;
    }

    if (!WEB_CLIENT_ID) {
      setState({
        status: 'unsupported',
        reason:
          'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set. Add it to .env and restart the Metro bundler.',
      });
      return;
    }

    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      scopes: ['profile', 'email'],
      offlineAccess: false,
    });

    // Try silent restore on first load.
    (async () => {
      try {
        const result = await GoogleSignin.signInSilently();
        if (result.type === 'success') {
          const authUser = toAuthUser(result.data);
          setState({
            status: 'signed-in',
            user: authUser,
            idToken: result.data.idToken,
          });
          if (result.data.idToken) {
            await SecureStore.setItemAsync(ID_TOKEN_KEY, result.data.idToken);
          }
          void analytics.identify(authUser);
          return;
        }
      } catch {
        // No saved credential — fall through to guest-or-signed-out.
      }

      // No Google session, but check if the user previously opted into
      // guest mode — if so, restore that instead of bouncing them back to
      // the sign-in screen on every launch.
      try {
        const guest = await SecureStore.getItemAsync(GUEST_PREF_KEY);
        if (guest === 'true') {
          setState({ status: 'guest' });
          return;
        }
      } catch {
        // SecureStore unavailable; fall through.
      }
      setState({ status: 'signed-out', error: null });
    })();
  }, []);

  const signIn = useCallback(async () => {
    // Allow sign-in from signed-out (the obvious path), signed-in (a no-op
    // re-sign), or guest (the upgrade path: guest → identified user).
    if (
      state.status !== 'signed-out' &&
      state.status !== 'signed-in' &&
      state.status !== 'guest'
    ) {
      return;
    }
    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const result = await GoogleSignin.signIn();
      if (result.type === 'cancelled') {
        setState({ status: 'signed-out', error: null });
        return;
      }
      const authUser = toAuthUser(result.data);
      setState({
        status: 'signed-in',
        user: authUser,
        idToken: result.data.idToken,
      });
      if (result.data.idToken) {
        await SecureStore.setItemAsync(ID_TOKEN_KEY, result.data.idToken);
      }
      // Signing in supersedes any previous guest preference.
      await SecureStore.deleteItemAsync(GUEST_PREF_KEY).catch(() => {});
      void analytics.identify(authUser);
      void analytics.track('app_opened', { source: 'sign_in' });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string; name?: string; userInfo?: unknown };
      console.warn('[GoogleSignIn] error', JSON.stringify(e, Object.getOwnPropertyNames(e)));
      const code = e.code;
      if (code === statusCodes.SIGN_IN_CANCELLED) {
        setState({ status: 'signed-out', error: null });
        return;
      }
      const baseMessage =
        code === statusCodes.IN_PROGRESS
          ? 'Sign-in already in progress.'
          : code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE
            ? 'Google Play Services unavailable on this device.'
            : (e.message ?? 'Sign-in failed.');
      const detail = code ? ` [code: ${code}]` : '';
      setState({ status: 'signed-out', error: `${baseMessage}${detail}` });
    }
  }, [state.status]);

  const signOut = useCallback(async () => {
    try {
      await GoogleSignin.signOut();
    } catch {
      // ignore
    }
    await SecureStore.deleteItemAsync(ID_TOKEN_KEY);
    // Sign-out drops the user back to the sign-in screen, NOT to guest. The
    // user explicitly asked to leave; respect that and let them re-pick.
    await SecureStore.deleteItemAsync(GUEST_PREF_KEY).catch(() => {});
    void analytics.reset();
    setState({ status: 'signed-out', error: null });
  }, []);

  const continueAsGuest = useCallback(async () => {
    // Persist the choice so cold starts skip the sign-in screen. This
    // matches the silent-restore path: signed-in users skip sign-in via a
    // valid Google session, guest users skip via this flag.
    await SecureStore.setItemAsync(GUEST_PREF_KEY, 'true').catch(() => {});
    setState({ status: 'guest' });
    void analytics.track('app_opened', { source: 'guest' });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, signIn, signOut, continueAsGuest }),
    [state, signIn, signOut, continueAsGuest]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
