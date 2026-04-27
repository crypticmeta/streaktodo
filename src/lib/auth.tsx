import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import {
  GoogleSignin,
  statusCodes,
  type User,
} from '@react-native-google-signin/google-signin';

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
  photo: string | null;
};

type AuthState =
  | { status: 'loading' }
  | { status: 'unsupported'; reason: string }
  | { status: 'signed-out'; error: string | null }
  | { status: 'signed-in'; user: AuthUser; idToken: string | null };

type AuthContextValue = {
  state: AuthState;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function toAuthUser(u: User): AuthUser {
  return {
    id: u.user.id,
    email: u.user.email,
    name: u.user.name,
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
          setState({
            status: 'signed-in',
            user: toAuthUser(result.data),
            idToken: result.data.idToken,
          });
          if (result.data.idToken) {
            await SecureStore.setItemAsync(ID_TOKEN_KEY, result.data.idToken);
          }
          return;
        }
      } catch {
        // No saved credential — fall through to signed-out.
      }
      setState({ status: 'signed-out', error: null });
    })();
  }, []);

  const signIn = useCallback(async () => {
    if (state.status !== 'signed-out' && state.status !== 'signed-in') return;
    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const result = await GoogleSignin.signIn();
      if (result.type === 'cancelled') {
        setState({ status: 'signed-out', error: null });
        return;
      }
      setState({
        status: 'signed-in',
        user: toAuthUser(result.data),
        idToken: result.data.idToken,
      });
      if (result.data.idToken) {
        await SecureStore.setItemAsync(ID_TOKEN_KEY, result.data.idToken);
      }
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
    setState({ status: 'signed-out', error: null });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ state, signIn, signOut }), [state, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
