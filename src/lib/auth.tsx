import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import {
  GoogleSignin,
  statusCodes,
  type User,
} from '@react-native-google-signin/google-signin';
import * as analytics from './analytics';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GUEST_PREF_KEY = 'auth_guest_v1';
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

export type AuthState =
  | { status: 'loading' }
  | { status: 'unsupported'; reason: string }
  | { status: 'signed-out'; error: string | null }
  | { status: 'guest'; error: string | null }
  | { status: 'signed-in'; user: AuthUser };

type AuthContextValue = {
  state: AuthState;
  busy: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(user: User): AuthUser {
  return {
    id: user.user.id,
    email: user.user.email,
    name: user.user.name,
  };
}

function signInMessage(error: unknown): string {
  const value = error as { code?: string; message?: string };
  if (value.code === statusCodes.IN_PROGRESS) return 'Sign-in is already in progress.';
  if (value.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return 'Google Play services is unavailable or needs an update.';
  }
  if (value.code === '10') {
    return 'This build is not registered for Google sign-in. Check its Android signing certificate in Google Cloud.';
  }
  return value.message?.trim() || 'Google sign-in failed. Try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (isExpoGo) {
      setState({
        status: 'unsupported',
        reason: 'Google sign-in needs an installed development or release build. You can still continue locally.',
      });
      return;
    }
    if (!WEB_CLIENT_ID) {
      setState({
        status: 'unsupported',
        reason: 'Google sign-in is not configured in this build. You can still continue locally.',
      });
      return;
    }

    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      scopes: ['profile', 'email'],
      offlineAccess: false,
    });

    void (async () => {
      try {
        const result = await GoogleSignin.signInSilently();
        if (!cancelled && result.type === 'success') {
          const user = toAuthUser(result.data);
          setState({ status: 'signed-in', user });
          void analytics.identify(user);
          return;
        }
      } catch {
        // No restorable Google session; guest preference is checked next.
      }
      try {
        const guest = await SecureStore.getItemAsync(GUEST_PREF_KEY);
        if (!cancelled && guest === 'true') {
          setState({ status: 'guest', error: null });
          return;
        }
      } catch {
        // If preference storage is unavailable, show the explicit choice.
      }
      if (!cancelled) setState({ status: 'signed-out', error: null });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    if (state.status !== 'signed-out' && state.status !== 'guest') return;
    const wasGuest = state.status === 'guest';
    if (isExpoGo || !WEB_CLIENT_ID) {
      const message = isExpoGo
        ? 'Google sign-in needs an installed development or release build.'
        : 'Google sign-in is not configured in this build.';
      setState(wasGuest
        ? { status: 'guest', error: message }
        : { status: 'unsupported', reason: `${message} You can still continue locally.` });
      return;
    }
    setBusy(true);
    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const result = await GoogleSignin.signIn();
      if (result.type === 'cancelled') {
        setState(wasGuest
          ? { status: 'guest', error: null }
          : { status: 'signed-out', error: null });
        return;
      }
      const user = toAuthUser(result.data);
      await SecureStore.deleteItemAsync(GUEST_PREF_KEY).catch(() => {});
      setState({ status: 'signed-in', user });
      void Promise.all([
        analytics.identify(user),
        analytics.track('sign_in_completed', { provider: 'google' }),
      ]);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === statusCodes.SIGN_IN_CANCELLED) {
        setState(wasGuest
          ? { status: 'guest', error: null }
          : { status: 'signed-out', error: null });
        return;
      }
      const message = signInMessage(error);
      setState(wasGuest
        ? { status: 'guest', error: message }
        : { status: 'signed-out', error: message });
    } finally {
      setBusy(false);
    }
  }, [state.status]);

  const signOut = useCallback(async () => {
    setBusy(true);
    // Preserve attribution ordering without making sign-out wait on analytics.
    void (async () => {
      await analytics.track('sign_out', { provider: 'google' });
      analytics.flush();
      await analytics.reset();
    })();
    try {
      try {
        await GoogleSignin.signOut();
      } catch {
        // Local sign-out should still complete if Google Play services fails.
      }
      await SecureStore.deleteItemAsync(GUEST_PREF_KEY).catch(() => {});
      setState({ status: 'signed-out', error: null });
    } finally {
      setBusy(false);
    }
  }, []);

  const continueAsGuest = useCallback(async () => {
    await SecureStore.setItemAsync(GUEST_PREF_KEY, 'true').catch(() => {});
    setState({ status: 'guest', error: null });
    void analytics.track('local_mode_selected');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, busy, signIn, signOut, continueAsGuest }),
    [state, busy, signIn, signOut, continueAsGuest]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
