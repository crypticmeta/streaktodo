import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDb } from '../src/db';
import { AuthProvider, useAuth } from '../src/lib/auth';
import * as analytics from '../src/lib/analytics';
import * as scheduler from '../src/lib/notificationScheduler';
import { OnboardingProvider, useOnboarding } from '../src/lib/onboarding';
import { ThemeProvider, useTheme } from '../src/theme';

type DbState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

function useDbBootstrap(): { state: DbState; retry: () => void } {
  const [state, setState] = useState<DbState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getDb();
        if (!cancelled) setState({ status: 'ready' });
        // Re-arm any reminders that the OS may have dropped (reboot,
        // force-quit, OEM battery killer). Best-effort; failures don't
        // block the app boot.
        void scheduler.reconcileAll().catch(() => {});
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
  }, [attempt]);

  return { state, retry };
}

function AppGate() {
  const { state: dbState, retry: retryDb } = useDbBootstrap();
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
          const result = await scheduler.handleNotificationResponse(response);
          if (result?.openTaskId) {
            router.replace({ pathname: '/(tabs)', params: { editTask: result.openTaskId } });
          }
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
            const result = await scheduler.handleNotificationResponse(response);
            if (result?.openTaskId) {
              router.replace({ pathname: '/(tabs)', params: { editTask: result.openTaskId } });
            }
            await Notifications.clearLastNotificationResponseAsync();
          })().catch(() => {});
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
  }, [dbState.status, router]);

  useEffect(() => {
    if (dbState.status !== 'ready') return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      scheduler.resetPermissionCache();
      void scheduler.reconcileAll().catch(() => {});
      void analytics.track('app_opened', { source: 'foreground' });
    });
    return () => subscription.remove();
  }, [dbState.status]);

  useEffect(() => {
    if (dbState.status !== 'ready') return;
    if (authState.status === 'loading') return;
    if (onboardingState === 'loading') return;

    const inAuth = segments[0] === 'sign-in';
    const inOnboarding = segments[0] === 'onboarding';
    const hasAccess = authState.status === 'signed-in' || authState.status === 'guest';

    if (!hasAccess) {
      if (!inAuth) router.replace('/sign-in');
      return;
    }

    if (onboardingState === 'pending') {
      if (!inOnboarding) router.replace('/onboarding');
      return;
    }

    if (inAuth || inOnboarding) {
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
        <Pressable
          onPress={retryDb}
          accessibilityRole="button"
          accessibilityLabel="Retry opening local data"
          style={({ pressed }) => [
            styles.retryButton,
            {
              backgroundColor: theme.color.accent,
              borderRadius: theme.radius.pill,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={{ color: theme.color.textOnAccent, fontWeight: theme.fontWeight.bold }}>
            Retry
          </Text>
        </Pressable>
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

function ThemedStatusBar() {
  const theme = useTheme();
  return <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <OnboardingProvider>
            <AppGate />
            <ThemedStatusBar />
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
  retryButton: {
    marginTop: 18,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
});
