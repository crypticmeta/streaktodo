import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { branding } from '../../branding';
import { BarChart } from '../../src/components/charts/BarChart';
import { DonutChart, type DonutSlice } from '../../src/components/charts/DonutChart';
import { Icon } from '../../src/components/Icon';
import { OverviewTotals } from '../../src/components/OverviewTotals';
import { StreakCounter } from '../../src/components/StreakCounter';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { UpcomingWeek } from '../../src/components/UpcomingWeek';
import {
  createBackupJson,
  parseBackupJson,
  resetLocalData,
  restoreBackupJson,
  useCategories,
  useInsights,
} from '../../src/db';
import * as analytics from '../../src/lib/analytics';
import { useAuth, type AuthState } from '../../src/lib/auth';
import * as scheduler from '../../src/lib/notificationScheduler';
import { useTheme } from '../../src/theme';
import { useTodayStart } from '../../src/lib/useToday';

// Fallback color for tasks that don't have a category. Sits on the muted
// gray axis of the design palette so it doesn't compete with real category
// colors in the donut.
const UNCATEGORIZED_COLOR = '#9a8f81';

export default function ProfileScreen() {
  const t = useTheme();
  const today = useTodayStart();
  const router = useRouter();
  const { state: authState, busy: authBusy, signIn, signOut } = useAuth();
  const [analyticsEnabled, setAnalyticsEnabledState] = useState<boolean | null>(null);
  const [analyticsBusy, setAnalyticsBusy] = useState(false);
  const {
    totals,
    streak,
    weekly,
    upcoming,
    breakdown,
    loading,
    error,
    refresh,
  } = useInsights(today);
  const { categories } = useCategories();

  useEffect(() => {
    let active = true;
    void analytics.getAnalyticsEnabled().then((enabled) => {
      if (active) setAnalyticsEnabledState(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  const categoriesById = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    for (const c of categories) {
      m.set(c.id, { name: c.name, color: c.color ?? UNCATEGORIZED_COLOR });
    }
    return m;
  }, [categories]);

  const donutSlices: DonutSlice[] = useMemo(
    () => {
      const visible = breakdown.slice(0, 5).map((slice) => {
        const cat = slice.categoryId ? categoriesById.get(slice.categoryId) : null;
        return {
          id: slice.categoryId ?? '__none',
          label: cat?.name ?? 'No Category',
          color: cat?.color ?? UNCATEGORIZED_COLOR,
          value: slice.count,
        };
      });
      const remaining = breakdown.slice(5).reduce((sum, slice) => sum + slice.count, 0);
      if (remaining > 0) {
        visible.push({ id: '__other', label: 'Other', color: '#6f7782', value: remaining });
      }
      return visible;
    },
    [breakdown, categoriesById]
  );

  const handleOpenExport = async () => {
    try {
      const json = await createBackupJson();
      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDir) throw new Error('No writable app directory is available on this device.');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileUri = `${baseDir}streaktodo-backup-${stamp}.json`;
      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      void analytics.track('backup_exported', { size_bytes: json.length });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          UTI: 'public.json',
          dialogTitle: 'Export Streak Todo backup',
        });
        return;
      }

      Alert.alert('Backup created', `Saved backup JSON to:\n${fileUri}`);
    } catch (error) {
      Alert.alert(
        'Export failed',
        error instanceof Error ? error.message : 'Could not generate the backup JSON.'
      );
    }
  };

  const handleImportPress = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const raw = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await handleImport(raw);
    } catch (error) {
      Alert.alert('Import failed', error instanceof Error ? error.message : 'Could not read the backup file.');
    }
  };

  const handleImport = async (json: string) => {
    try {
      parseBackupJson(json);
    } catch (error) {
      Alert.alert(
        'Import failed',
        error instanceof Error ? error.message : 'Choose a valid Streak Todo backup.'
      );
      return;
    }
    Alert.alert(
      'Replace local data?',
      'Importing a backup replaces all current local tasks, categories, reminders, repeat rules, and subtasks on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await scheduler.resetAllScheduledNotifications();
                await restoreBackupJson(json);
                void analytics.track('backup_imported', { size_bytes: json.length });
              } catch (error) {
                // The DB restore is transactional. If it failed, the previous
                // dataset is still present, so re-arm its reminders.
                await scheduler.reconcileAll().catch(() => {});
                Alert.alert(
                  'Import failed',
                  error instanceof Error ? error.message : 'The selected backup file is invalid.'
                );
                return;
              }

              try {
                await scheduler.reconcileAll();
                Alert.alert('Import complete', 'Your local data has been restored from the backup file.');
              } catch (error) {
                // The import itself is already committed. Do not call it a
                // failed import or attempt to restore the replaced dataset.
                Alert.alert(
                  'Import complete; reminders need attention',
                  error instanceof Error
                    ? error.message
                    : 'Open the app again to retry reminder scheduling.'
                );
              }
            })();
          },
        },
      ]
    );
  };

  const handleResetLocalData = () => {
    Alert.alert(
      'Reset local data?',
      'This will permanently remove all local tasks, subtasks, reminders, repeat rules, and custom categories from this device. Default categories will be recreated.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await scheduler.resetAllScheduledNotifications();
                await resetLocalData();
                void analytics.track('local_data_reset');
                Alert.alert('Reset complete', 'Local data has been cleared on this device.');
              } catch (error) {
                // If the transactional reset failed after OS alarms were
                // cleared, restore reminders for the still-present data.
                await scheduler.reconcileAll().catch(() => {});
                Alert.alert(
                  'Reset failed',
                  error instanceof Error ? error.message : 'Could not clear local data.'
                );
              }
            })();
          },
        },
      ]
    );
  };

  const handleAnalyticsToggle = async (enabled: boolean) => {
    setAnalyticsBusy(true);
    try {
      await analytics.setAnalyticsEnabled(enabled);
      setAnalyticsEnabledState(enabled);
    } catch (error) {
      Alert.alert(
        'Couldn’t update analytics',
        error instanceof Error ? error.message : 'Try again in a moment.'
      );
    } finally {
      setAnalyticsBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.color.background }]} edges={['top']}>
      <ScrollView
        refreshControl={(
          <RefreshControl
            refreshing={loading}
            onRefresh={() => { void refresh(); }}
            tintColor={t.color.accent}
            colors={[t.color.accent]}
          />
        )}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: t.spacing.xl,
            paddingTop: t.spacing.lg,
            paddingBottom: t.spacing['6xl'],
            gap: t.spacing.lg,
          },
        ]}
      >
        <View style={styles.insightsHero}>
          <View style={{ flex: 1 }}>
            <View style={[styles.insightsKicker, { backgroundColor: t.color.warnSoft, borderRadius: t.radius.pill }]}>
              <Icon name="sparkles" size={13} color={t.color.warn} />
              <Text style={{ color: t.color.warn, fontSize: t.fontSize.xs, fontWeight: t.fontWeight.bold, letterSpacing: t.tracking.wide }}>
                YOUR MOMENTUM
              </Text>
            </View>
            <Text
              style={{
                color: t.color.textPrimary,
                fontSize: t.fontSize['3xl'],
                fontWeight: t.fontWeight.heavy,
                letterSpacing: t.tracking.tight,
              }}
            >
              Small wins, visible.
            </Text>
            <Text style={{ color: t.color.textSecondary, fontSize: t.fontSize.sm, marginTop: 3 }}>
              See what’s moving and keep your streak warm.
            </Text>
          </View>
          <View style={[styles.heroFlame, { backgroundColor: t.color.warnSoft, borderRadius: t.radius['2xl'] }]}>
            <Icon name="flame" size={31} color={t.color.warn} />
          </View>
        </View>

        <Section title="Account">
          <AccountCard
            state={authState}
            busy={authBusy}
            onSignIn={() => { void signIn(); }}
            onSignOut={() => { void signOut(); }}
          />
        </Section>

        {loading && totals.total === 0 ? (
          <ActivityIndicator color={t.color.accent} accessibilityLabel="Loading insights" />
        ) : null}

        {error ? (
          <Pressable
            onPress={() => { void refresh(); }}
            accessibilityRole="button"
            accessibilityLabel="Retry loading insights"
            style={[styles.localNotice, { backgroundColor: t.color.dangerSoft, borderRadius: t.radius.xl }]}
          >
            <Icon name="close" size={18} color={t.color.danger} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.color.textPrimary, fontSize: t.fontSize.sm, fontWeight: t.fontWeight.bold }}>
                Couldn’t load insights
              </Text>
              <Text style={{ color: t.color.textSecondary, fontSize: t.fontSize.xs, marginTop: 2 }}>
                {error} Tap to try again.
              </Text>
            </View>
          </Pressable>
        ) : null}

        <View
          style={[
            styles.localNotice,
            { backgroundColor: t.color.successSoft, borderRadius: t.radius.xl },
          ]}
          accessibilityRole="summary"
        >
          <Icon name="check" size={18} color={t.color.success} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.color.textPrimary, fontSize: t.fontSize.sm, fontWeight: t.fontWeight.bold }}>
              Your task content stays local
            </Text>
            <Text style={{ color: t.color.textSecondary, fontSize: t.fontSize.xs, marginTop: 2 }}>
              Google identifies your account. Mixpanel receives coarse product actions—not task text or backup contents.
            </Text>
          </View>
        </View>

        <OverviewTotals totals={totals} />

        <StreakCounter stats={streak} />

        <Section title="Completed each day">
          <BarChart bars={weekly} />
        </Section>

        <UpcomingWeek days={upcoming} />

        <Section title="Categories">
          <DonutChart slices={donutSlices} />
        </Section>

        <ThemeToggle />

        <Section title="Privacy">
          <View
            style={[
              styles.privacyCard,
              {
                backgroundColor: t.color.surface,
                borderRadius: t.radius.xl,
                padding: t.spacing.lg,
              },
            ]}
          >
            <View style={styles.utilityBody}>
              <Text style={{ color: t.color.textPrimary, fontSize: t.fontSize.md, fontWeight: t.fontWeight.semibold }}>
                Share product usage
              </Text>
              <Text style={{ color: t.color.textSecondary, fontSize: t.fontSize.sm, lineHeight: 19 }}>
                Helps improve Streak Todo. Task titles, notes, subtask text, category names, reminder text, and backups are excluded.
              </Text>
            </View>
            {analyticsEnabled === null ? (
              <ActivityIndicator color={t.color.accent} accessibilityLabel="Loading analytics preference" />
            ) : (
              <Switch
                value={analyticsEnabled}
                onValueChange={(enabled) => { void handleAnalyticsToggle(enabled); }}
                disabled={analyticsBusy}
                trackColor={{ false: t.color.borderStrong, true: t.color.accentSoft }}
                thumbColor={analyticsEnabled ? t.color.accent : t.color.textMuted}
                accessibilityLabel="Share product usage analytics"
                accessibilityHint="Turns privacy-bounded Mixpanel analytics on or off"
              />
            )}
          </View>
          <Pressable
            onPress={() => { void Linking.openURL(branding.privacyUrl).catch(() => {}); }}
            accessibilityRole="link"
            accessibilityLabel="Open privacy policy"
            style={({ pressed }) => [
              styles.manageRow,
              {
                backgroundColor: pressed ? t.color.surfaceMuted : t.color.surface,
                borderRadius: t.radius.xl,
                padding: t.spacing.lg,
                marginTop: t.spacing.sm,
              },
            ]}
          >
            <Icon name="note" size={18} color={t.color.textPrimary} />
            <Text style={{ color: t.color.textPrimary, fontSize: t.fontSize.md, fontWeight: t.fontWeight.semibold, flex: 1 }}>
              Privacy policy
            </Text>
            <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.lg }}>›</Text>
          </Pressable>
          <Pressable
            onPress={() => { void Linking.openURL(branding.deletionUrl).catch(() => {}); }}
            accessibilityRole="link"
            accessibilityLabel="Open account and analytics data deletion page"
            style={({ pressed }) => [
              styles.manageRow,
              {
                backgroundColor: pressed ? t.color.dangerSoft : t.color.surface,
                borderRadius: t.radius.xl,
                padding: t.spacing.lg,
                marginTop: t.spacing.sm,
              },
            ]}
          >
            <Icon name="trash" size={18} color={t.color.danger} />
            <View style={styles.utilityBody}>
              <Text style={{ color: t.color.textPrimary, fontSize: t.fontSize.md, fontWeight: t.fontWeight.semibold }}>
                Delete account data
              </Text>
              <Text style={{ color: t.color.textSecondary, fontSize: t.fontSize.sm }}>
                Disconnect Google and request deletion of associated analytics data.
              </Text>
            </View>
            <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.lg }}>›</Text>
          </Pressable>
        </Section>

        <Section title="Data">
          <Pressable
            onPress={() => void handleOpenExport()}
            style={({ pressed }) => [
              styles.manageRow,
              styles.utilityRow,
              {
                backgroundColor: pressed ? t.color.surfaceMuted : t.color.surface,
                borderRadius: t.radius.xl,
                padding: t.spacing.lg,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Export backup"
          >
            <Icon name="note" size={18} color={t.color.textPrimary} />
            <View style={styles.utilityBody}>
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontSize: t.fontSize.md,
                  fontWeight: t.fontWeight.semibold,
                }}
              >
                Export backup
              </Text>
              <Text style={{ color: t.color.textSecondary, fontSize: t.fontSize.sm }}>
                Generate a full JSON snapshot of your local data.
              </Text>
            </View>
            <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.lg }}>›</Text>
          </Pressable>

          <Pressable
            onPress={() => void handleImportPress()}
            style={({ pressed }) => [
              styles.manageRow,
              styles.utilityRow,
              {
                backgroundColor: pressed ? t.color.surfaceMuted : t.color.surface,
                borderRadius: t.radius.xl,
                padding: t.spacing.lg,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Import backup"
          >
            <Icon name="calendar" size={18} color={t.color.textPrimary} />
            <View style={styles.utilityBody}>
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontSize: t.fontSize.md,
                  fontWeight: t.fontWeight.semibold,
                }}
              >
                Import backup
              </Text>
              <Text style={{ color: t.color.textSecondary, fontSize: t.fontSize.sm }}>
                Choose a backup file and replace the data on this device.
              </Text>
            </View>
            <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.lg }}>›</Text>
          </Pressable>

          <Pressable
            onPress={handleResetLocalData}
            style={({ pressed }) => [
              styles.manageRow,
              styles.utilityRow,
              {
                backgroundColor: pressed ? t.color.surfaceMuted : t.color.surface,
                borderRadius: t.radius.xl,
                padding: t.spacing.lg,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Reset local data"
          >
            <Icon name="trash" size={18} color={t.color.danger} />
            <View style={styles.utilityBody}>
              <Text
                style={{
                  color: t.color.danger,
                  fontSize: t.fontSize.md,
                  fontWeight: t.fontWeight.semibold,
                }}
              >
                Reset local data
              </Text>
              <Text style={{ color: t.color.textSecondary, fontSize: t.fontSize.sm }}>
                Clear this device and start again with the default categories.
              </Text>
            </View>
            <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.lg }}>›</Text>
          </Pressable>
        </Section>

        <Pressable
          onPress={() => router.push('/categories')}
          style={({ pressed }) => [
            styles.manageRow,
            {
              backgroundColor: pressed ? t.color.surfaceMuted : t.color.surface,
              borderRadius: t.radius.xl,
              padding: t.spacing.lg,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Manage categories"
        >
          <Icon name="edit" size={18} color={t.color.textPrimary} />
          <Text
            style={{
              color: t.color.textPrimary,
              fontSize: t.fontSize.md,
              fontWeight: t.fontWeight.semibold,
              flex: 1,
            }}
          >
            Manage categories
          </Text>
          <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.lg }}>›</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/trash' as never)}
          style={({ pressed }) => [
            styles.manageRow,
            {
              backgroundColor: pressed ? t.color.surfaceMuted : t.color.surface,
              borderRadius: t.radius.xl,
              padding: t.spacing.lg,
              marginTop: t.spacing.md,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open recently deleted tasks"
        >
          <Icon name="trash" size={18} color={t.color.textPrimary} />
          <Text style={{ color: t.color.textPrimary, fontSize: t.fontSize.md, fontWeight: t.fontWeight.semibold, flex: 1 }}>
            Recently deleted
          </Text>
          <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.lg }}>›</Text>
        </Pressable>

        <Text
          style={{
            color: t.color.textMuted,
            fontSize: t.fontSize.xs,
            textAlign: 'center',
            marginTop: t.spacing.sm,
          }}
        >
          {branding.appName}
        </Text>

        {/* Quiet attribution row. Tapping CODERIXX opens the studio site in
            the system browser. Errors are swallowed — we don't want a missing
            browser to surface a scary alert at the bottom of the Profile. */}
        <Text
          style={{
            color: t.color.textMuted,
            fontSize: t.fontSize.xs,
            textAlign: 'center',
            marginTop: 2,
          }}
        >
          Made by{' '}
          <Text
            onPress={() => {
              void Linking.openURL('https://coderixx.com').catch(() => {});
            }}
            accessibilityRole="link"
            accessibilityLabel="Made by CODERIXX, opens coderixx.com"
            style={{
              color: t.color.textSecondary,
              fontWeight: t.fontWeight.semibold,
            }}
          >
            CODERIXX
          </Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View>
      <Text
        style={{
          color: t.color.textPrimary,
          fontSize: t.fontSize.lg,
          fontWeight: t.fontWeight.bold,
          paddingBottom: t.spacing.sm,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function AccountCard({
  state,
  busy,
  onSignIn,
  onSignOut,
}: {
  state: AuthState;
  busy: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  const t = useTheme();
  const user = state.status === 'signed-in' ? state.user : null;
  const guestError = state.status === 'guest' ? state.error : null;
  const initial = user
    ? (user.name?.trim()[0] ?? user.email[0] ?? 'S').toUpperCase()
    : 'S';

  return (
    <View
      style={[
        styles.accountCard,
        {
          backgroundColor: t.color.surface,
          borderRadius: t.radius.xl,
          padding: t.spacing.lg,
        },
      ]}
    >
      <View style={styles.accountMain}>
        <View style={[styles.avatar, { backgroundColor: t.color.accentSoft, borderRadius: t.radius.pill }]}>
          <Text style={{ color: t.color.accent, fontSize: t.fontSize.lg, fontWeight: t.fontWeight.heavy }}>
            {initial}
          </Text>
        </View>
        <View style={styles.accountIdentity}>
          <Text
            numberOfLines={1}
            style={{ color: t.color.textPrimary, fontSize: t.fontSize.md, fontWeight: t.fontWeight.bold }}
          >
            {user?.name ?? (user ? 'Google account' : 'Using Streak Todo locally')}
          </Text>
          <Text numberOfLines={1} style={{ color: t.color.textSecondary, fontSize: t.fontSize.sm }}>
            {user?.email ?? 'No Google account connected'}
          </Text>
        </View>
        <Pressable
          onPress={user ? onSignOut : onSignIn}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={user ? 'Sign out of Google' : 'Sign in with Google'}
          accessibilityHint="Your tasks and backups remain stored on this device"
          style={({ pressed }) => [
            styles.accountAction,
            {
              borderColor: user ? t.color.danger : t.color.borderStrong,
              borderRadius: t.radius.pill,
              opacity: busy ? 0.5 : pressed ? 0.72 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={user ? t.color.danger : t.color.accent} />
          ) : (
            <Text style={{ color: user ? t.color.danger : t.color.accent, fontSize: t.fontSize.sm, fontWeight: t.fontWeight.bold }}>
              {user ? 'Sign out' : 'Sign in'}
            </Text>
          )}
        </Pressable>
      </View>
      <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.xs, lineHeight: 18 }}>
        Google sign-in restores your identity, not your tasks. Use Export backup to move task data between devices.
      </Text>
      {guestError ? (
        <Text accessibilityRole="alert" style={{ color: t.color.danger, fontSize: t.fontSize.sm, lineHeight: 19 }}>
          {guestError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {},
  localNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  insightsHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 2,
  },
  insightsKicker: {
    alignSelf: 'flex-start',
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  heroFlame: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '5deg' }],
  },
  accountCard: {
    gap: 13,
  },
  accountMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountIdentity: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  accountAction: {
    minWidth: 72,
    minHeight: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  privacyCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  utilityRow: {
    marginBottom: 12,
  },
  utilityBody: {
    flex: 1,
    gap: 4,
  },
});
