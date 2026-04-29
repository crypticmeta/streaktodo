import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { getDb } from '../src/db';
import * as analytics from '../src/lib/analytics';
import * as scheduler from '../src/lib/notificationScheduler';
import { OnboardingProvider, useOnboarding } from '../src/lib/onboarding';
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
        // Cold-start session marker. Mixpanel auto-tracks `App Open` already
        // when trackAutomaticEvents is on, but we emit our own so the event
        // schema is fully owned + consistent across versions.
        void analytics.track('app_opened', { source: 'cold_start' });
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

function AppGate() {
  const dbState = useDbBootstrap();
  const { state: authState } = useAuth();
  const { state: onboardingState } = useOnboarding();
  const router = useRouter();
  const segments = useSegments();
  const theme = useTheme();

  useEffect(() => {
    if (dbState.status !== 'ready') return;

    let active = true;
    let responseSubscription: { remove: () => void } | null = null;
    let receiveSubscription: { remove: () => void } | null = null;

    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
        await scheduler.primeNotificationActions();
        if (!active) return;

        const consume = async (
          response: Awaited<ReturnType<typeof Notifications.getLastNotificationResponseAsync>>
        ) => {
          if (!response) return;
          await scheduler.handleNotificationResponse(response);
          await Notifications.clearLastNotificationResponseAsync();
        };

        const last = await Notifications.getLastNotificationResponseAsync();
        if (!active) return;
        await consume(last);

        receiveSubscription = Notifications.addNotificationReceivedListener((notification) => {
          scheduler.logNotificationTiming(notification.request.content.data, 'received');
        });

        responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
          void (async () => {
            await scheduler.handleNotificationResponse(response);
            await Notifications.clearLastNotificationResponseAsync();
          })();
        });
      } catch {
        // Best-effort only. Notifications still fire even if action wiring
        // fails in this session.
      }
    })();

    return () => {
      active = false;
      responseSubscription?.remove();
      receiveSubscription?.remove();
    };
  }, [dbState.status]);

  useEffect(() => {
    if (dbState.status !== 'ready') return;
    if (authState.status === 'loading') return;
    if (onboardingState === 'loading') return;

    const inAuthGroup = segments[0] === 'sign-in';
    const inOnboarding = segments[0] === 'onboarding';
    // Both signed-in and guest are "let through" — the app is local-first
    // and fully usable in either mode. Guest mode exists so Play Store
    // reviewers (and privacy-conscious users) can use the app without a
    // Google account.
    const isAuthenticated =
      authState.status === 'signed-in' || authState.status === 'guest';

    // Routing precedence:
    //   1. Not authenticated → /sign-in
    //   2. Authenticated but onboarding pending → /onboarding
    //   3. Authenticated + onboarded → /(tabs)
    if (!isAuthenticated) {
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
          <OnboardingProvider>
            <AppGate />
            <StatusBar style="auto" />
          </OnboardingProvider>
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
