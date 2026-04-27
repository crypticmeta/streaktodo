import { useEffect, useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { branding } from '../../branding';
import { useAuth } from '../lib/auth';
import { colors } from '../theme/colors';

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
  const { state, signOut } = useAuth();
  const [lastEvent, setLastEvent] = useState<string>('—');
  const [notifications, setNotifications] = useState<NotificationsModule | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const notificationsUnavailable = isAndroidExpoGo || !notifications || !!loadError;
  const runtimeLabel = isAndroidExpoGo ? 'Expo Go limitation' : 'Development build ready';
  const runtimeTone = isAndroidExpoGo ? styles.runtimeBadgeWarn : styles.runtimeBadgeOk;

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
    <View style={styles.container}>
      <View style={styles.shell}>
        {user ? (
          <View style={styles.userBar}>
            <View style={styles.userBarLeft}>
              {user.photo ? (
                <Image source={{ uri: user.photo }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>
                    {user.name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View>
                <Text style={styles.userName}>{user.name ?? 'Signed in'}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
            </View>
            <Pressable onPress={signOut} hitSlop={8}>
              <Text style={styles.signOut}>Sign out</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <View style={[styles.runtimeBadge, runtimeTone]}>
            <Text style={styles.runtimeBadgeText}>{runtimeLabel}</Text>
          </View>

          <Text style={styles.eyebrow}>Local notifications</Text>
          <Text style={styles.title}>{branding.appName}</Text>
          <Text style={styles.subtitle}>
            Minimal test surface for immediate and delayed device notifications.
          </Text>

          {isAndroidExpoGo ? (
            <View style={styles.messageBox}>
              <Text style={styles.messageTitle}>Android Expo Go is not enough here.</Text>
              <Text style={styles.helperText}>
                Install a development build, then run the same screen there.
              </Text>
            </View>
          ) : null}

          {loadError ? (
            <View style={[styles.messageBox, styles.messageBoxMuted]}>
              <Text style={styles.messageTitle}>Load error</Text>
              <Text style={styles.helperText}>{loadError}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[styles.button, notificationsUnavailable ? styles.buttonDisabled : null]}
            onPress={fireNow}
            disabled={notificationsUnavailable}
          >
            <Text style={styles.buttonTitle}>Fire now</Text>
            <Text style={styles.buttonCaption}>Instant alert on this device</Text>
          </Pressable>

          <Pressable
            style={[
              styles.button,
              styles.buttonSecondary,
              notificationsUnavailable ? styles.buttonDisabled : null,
            ]}
            onPress={fireIn5s}
            disabled={notificationsUnavailable}
          >
            <Text style={styles.buttonTitle}>Fire in 5s</Text>
            <Text style={styles.buttonCaption}>Background the app and confirm delivery</Text>
          </Pressable>
        </View>

        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Last event</Text>
          <Text style={styles.statusValue}>{lastEvent}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
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
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    backgroundColor: colors.muted,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  userEmail: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  signOut: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#6f4e37',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  eyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: colors.textTertiary,
    marginTop: 18,
    marginBottom: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 8,
  },
  runtimeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  runtimeBadgeOk: {
    backgroundColor: colors.primarySoft,
  },
  runtimeBadgeWarn: {
    backgroundColor: colors.warn,
  },
  runtimeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3c3125',
  },
  messageBox: {
    marginTop: 18,
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#f8eddc',
    borderWidth: 1,
    borderColor: '#ead7b7',
  },
  messageBoxMuted: {
    backgroundColor: colors.muted,
    borderColor: colors.mutedBorder,
  },
  messageTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2f261f',
  },
  actions: {
    gap: 12,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 22,
    minWidth: 240,
    alignItems: 'flex-start',
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  buttonSecondary: {
    backgroundColor: colors.secondary,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonTitle: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonCaption: {
    color: colors.textOnPrimarySoft,
    fontSize: 13,
    marginTop: 4,
  },
  statusBox: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minWidth: 240,
    alignItems: 'flex-start',
  },
  statusLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  statusValue: {
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 8,
    fontWeight: '600',
    textAlign: 'left',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#5f5246',
    marginTop: 8,
    textAlign: 'left',
  },
});
