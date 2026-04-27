import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { getDb } from '../src/db';
import * as scheduler from '../src/lib/notificationScheduler';
import { getOnboardingCompleted } from '../src/lib/onboarding';
import { ThemeProvider, useTheme } from '../src/theme';

type DbState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

function useDbBootstrap(): DbState {
  const [state, setState] = useState<DbState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getDb();
        if (!cancelled) setState({ status: 'ready' });
        // Re-arm any reminders that the OS may have dropped (reboot,
        // force-quit, OEM battery killer). Best-effort; failures don't
        // block the app boot.
        void scheduler.reconcileAll();
      } catch (err) {
        if (cancelled) return;
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Database failed to open.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

type OnboardingState = 'loading' | 'pending' | 'completed';

function useOnboardingState(): OnboardingState {
  const [state, setState] = useState<OnboardingState>('loading');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const done = await getOnboardingCompleted();
      if (!cancelled) setState(done ? 'completed' : 'pending');
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

function AppGate() {
  const dbState = useDbBootstrap();
  const { state: authState } = useAuth();
  const onboardingState = useOnboardingState();
  const router = useRouter();
  const segments = useSegments();
  const theme = useTheme();

  useEffect(() => {
    if (dbState.status !== 'ready') return;
    if (authState.status === 'loading') return;
    if (onboardingState === 'loading') return;

    const inAuthGroup = segments[0] === 'sign-in';
    const inOnboarding = segments[0] === 'onboarding';
    const isSignedIn = authState.status === 'signed-in';

    // Routing precedence:
    //   1. Not signed in → /sign-in
    //   2. Signed in but onboarding pending → /onboarding
    //   3. Signed in + onboarded → /(tabs)
    if (!isSignedIn) {
      if (!inAuthGroup) router.replace('/sign-in');
      return;
    }

    if (onboardingState === 'pending') {
      if (!inOnboarding) router.replace('/onboarding');
      return;
    }

    if (inAuthGroup || inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [dbState.status, authState.status, onboardingState, segments, router]);

  if (dbState.status === 'error') {
    return (
      <View style={[styles.loading, { backgroundColor: theme.color.background }]}>
        <Text style={{ color: theme.color.danger, fontWeight: '700', marginBottom: 8 }}>
          Database error
        </Text>
        <Text style={{ color: theme.color.textSecondary, textAlign: 'center', paddingHorizontal: 24 }}>
          {dbState.message}
        </Text>
      </View>
    );
  }

  if (
    dbState.status === 'loading' ||
    authState.status === 'loading' ||
    onboardingState === 'loading'
  ) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.color.background }]}>
        <ActivityIndicator color={theme.color.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.color.background },
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppGate />
          <StatusBar style="auto" />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
