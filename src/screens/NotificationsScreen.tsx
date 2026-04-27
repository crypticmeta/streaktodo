import { useEffect, useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { branding } from '../../branding';
import { useAuth } from '../lib/auth';
import { useTheme } from '../theme';

type NotificationsModule = typeof import('expo-notifications');
type NotificationSubscription = { remove: () => void };

const isAndroidExpoGo =
  Platform.OS === 'android' &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

async function ensurePermissions(notifications: NotificationsModule): Promise<boolean> {
  if (!Device.isDevice) {
    Alert.alert(
      'Use a real device',
      'Notifications only fire on physical devices, not simulators.'
    );
    return false;
  }

  if (Platform.OS === 'android') {
    await notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const existing = await notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await notifications.requestPermissionsAsync();
    status = req.status;
  }

  if (status !== 'granted') {
    Alert.alert('Permission denied', 'Enable notifications in system settings.');
    return false;
  }

  return true;
}

export function NotificationsScreen() {
  const t = useTheme();
  const { state, signOut } = useAuth();
  const [lastEvent, setLastEvent] = useState<string>('—');
  const [notifications, setNotifications] = useState<NotificationsModule | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const notificationsUnavailable = isAndroidExpoGo || !notifications || !!loadError;
  const runtimeLabel = isAndroidExpoGo ? 'Expo Go limitation' : 'Development build ready';

  useEffect(() => {
    if (isAndroidExpoGo) return;

    let mounted = true;
    let sub: NotificationSubscription | null = null;

    (async () => {
      try {
        const notificationsModule = await import('expo-notifications');
        notificationsModule.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });

        sub = notificationsModule.addNotificationReceivedListener((n) => {
          setLastEvent(`received: ${n.request.content.title ?? '(untitled)'}`);
        });

        if (mounted) {
          setNotifications(notificationsModule);
        } else {
          sub.remove();
        }
      } catch (error) {
        if (mounted) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load notifications.');
        }
      }
    })();

    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

  const fireNow = async () => {
    if (!notifications) return;
    if (!(await ensurePermissions(notifications))) return;
    await notifications.scheduleNotificationAsync({
      content: {
        title: `${branding.appName} test`,
        body: 'Fired immediately. Notifications work.',
      },
      trigger: null,
    });
    setLastEvent('scheduled: fire-now');
  };

  const fireIn5s = async () => {
    if (!notifications) return;
    if (!(await ensurePermissions(notifications))) return;
    await notifications.scheduleNotificationAsync({
      content: {
        title: `${branding.appName} delayed`,
        body: 'This was scheduled 5 seconds ago.',
      },
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
      },
    });
    setLastEvent('scheduled: in 5s');
  };

  const user = state.status === 'signed-in' ? state.user : null;

  return (
    <View style={[styles.container, { backgroundColor: t.color.background }]}>
      <View style={styles.shell}>
        {user ? (
          <View
            style={[
              styles.userBar,
              {
                backgroundColor: t.color.surface,
                borderColor: t.color.border,
                borderRadius: t.radius.xl,
                padding: t.spacing.md,
              },
            ]}
          >
            <View style={styles.userBarLeft}>
              {user.photo ? (
                <Image source={{ uri: user.photo }} style={[styles.avatar, { backgroundColor: t.color.surfaceMuted }]} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: t.color.surfaceMuted }]}>
                  <Text style={{ color: t.color.textPrimary, fontWeight: t.fontWeight.bold }}>
                    {user.name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View>
                <Text style={{ fontSize: t.fontSize.base, fontWeight: t.fontWeight.bold, color: t.color.textPrimary }}>
                  {user.name ?? 'Signed in'}
                </Text>
                <Text style={{ fontSize: t.fontSize.sm, color: t.color.textSecondary }}>
                  {user.email}
                </Text>
              </View>
            </View>
            <Pressable onPress={signOut} hitSlop={8}>
              <Text style={{ fontSize: t.fontSize.sm, fontWeight: t.fontWeight.semibold, color: t.color.accent }}>
                Sign out
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: t.color.surface,
              borderColor: t.color.border,
              borderRadius: t.radius['3xl'],
              padding: t.spacing['2xl'],
              ...t.elevation.lg,
            },
          ]}
        >
          <View
            style={[
              styles.runtimeBadge,
              {
                backgroundColor: isAndroidExpoGo ? t.color.warnSoft : t.color.successSoft,
              },
            ]}
          >
            <Text style={{ fontSize: t.fontSize.xs, fontWeight: t.fontWeight.bold, color: t.color.textPrimary }}>
              {runtimeLabel}
            </Text>
          </View>

          <Text
            style={{
              fontSize: t.fontSize.xs,
              textTransform: 'uppercase',
              letterSpacing: t.tracking.wider,
              color: t.color.textMuted,
              fontWeight: t.fontWeight.bold,
              marginTop: t.spacing.lg,
              marginBottom: 10,
            }}
          >
            Local notifications
          </Text>
          <Text
            style={{
              fontSize: t.fontSize['4xl'],
              fontWeight: t.fontWeight.bold,
              color: t.color.textPrimary,
              letterSpacing: t.tracking.tight,
            }}
          >
            {branding.appName}
          </Text>
          <Text
            style={{
              fontSize: t.fontSize.base,
              lineHeight: t.fontSize.base * t.lineHeight.normal,
              color: t.color.textSecondary,
              marginTop: t.spacing.sm,
            }}
          >
            Minimal test surface for immediate and delayed device notifications.
          </Text>

          {isAndroidExpoGo ? (
            <View style={[styles.messageBox, { backgroundColor: t.color.warnSoft, borderColor: t.color.borderMuted, borderRadius: t.radius.xl, padding: t.spacing.lg, marginTop: t.spacing.lg }]}>
              <Text style={{ fontSize: t.fontSize.md, fontWeight: t.fontWeight.bold, color: t.color.textPrimary }}>
                Android Expo Go is not enough here.
              </Text>
              <Text style={{ fontSize: t.fontSize.sm, lineHeight: t.fontSize.sm * t.lineHeight.normal, color: t.color.textSecondary, marginTop: 8 }}>
                Install a development build, then run the same screen there.
              </Text>
            </View>
          ) : null}

          {loadError ? (
            <View style={[styles.messageBox, { backgroundColor: t.color.surfaceMuted, borderColor: t.color.borderMuted, borderRadius: t.radius.xl, padding: t.spacing.lg, marginTop: t.spacing.lg }]}>
              <Text style={{ fontSize: t.fontSize.md, fontWeight: t.fontWeight.bold, color: t.color.danger }}>
                Load error
              </Text>
              <Text style={{ fontSize: t.fontSize.sm, lineHeight: t.fontSize.sm * t.lineHeight.normal, color: t.color.textSecondary, marginTop: 8 }}>
                {loadError}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: t.color.accent,
                borderRadius: t.radius['2xl'],
                paddingHorizontal: t.spacing.lg,
                paddingVertical: t.spacing.lg,
                ...t.elevation.md,
                shadowColor: t.color.accent,
              },
              notificationsUnavailable && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={fireNow}
            disabled={notificationsUnavailable}
          >
            <Text style={{ color: t.color.textOnAccent, fontSize: t.fontSize.lg, fontWeight: t.fontWeight.bold }}>
              Fire now
            </Text>
            <Text style={{ color: t.color.textOnAccentSoft, fontSize: t.fontSize.sm, marginTop: 4 }}>
              Instant alert on this device
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: t.color.surfaceMuted,
                borderRadius: t.radius['2xl'],
                paddingHorizontal: t.spacing.lg,
                paddingVertical: t.spacing.lg,
              },
              notificationsUnavailable && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={fireIn5s}
            disabled={notificationsUnavailable}
          >
            <Text style={{ color: t.color.textPrimary, fontSize: t.fontSize.lg, fontWeight: t.fontWeight.bold }}>
              Fire in 5s
            </Text>
            <Text style={{ color: t.color.textSecondary, fontSize: t.fontSize.sm, marginTop: 4 }}>
              Background the app and confirm delivery
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.statusBox,
            {
              backgroundColor: t.color.surface,
              borderColor: t.color.border,
              borderRadius: t.radius['2xl'],
              padding: t.spacing.lg,
            },
          ]}
        >
          <Text
            style={{
              fontSize: t.fontSize.xs,
              color: t.color.textMuted,
              textTransform: 'uppercase',
              letterSpacing: t.tracking.wider,
              fontWeight: t.fontWeight.bold,
            }}
          >
            Last event
          </Text>
          <Text
            style={{
              fontSize: t.fontSize.base,
              color: t.color.textPrimary,
              marginTop: 8,
              fontWeight: t.fontWeight.semibold,
            }}
          >
            {lastEvent}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  shell: {
    width: '100%',
    maxWidth: 420,
    gap: 14,
  },
  userBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  userBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    borderWidth: 1,
  },
  runtimeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  messageBox: {
    borderWidth: 1,
  },
  actions: {
    gap: 12,
  },
  button: {
    minWidth: 240,
    alignItems: 'flex-start',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  statusBox: {
    minWidth: 240,
    alignItems: 'flex-start',
    borderWidth: 1,
  },
});
