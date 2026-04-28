import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { createBackupJson, resetLocalData, restoreBackupJson, useCategories, useTasks } from '../../src/db';
import * as analytics from '../../src/lib/analytics';
import { useAuth } from '../../src/lib/auth';
import * as scheduler from '../../src/lib/notificationScheduler';
import {
  computeCategoryBreakdown,
  computeOverviewTotals,
  computeStreakStats,
  computeUpcomingWeek,
  computeWeeklyCompletion,
} from '../../src/lib/streakStats';
import { useTheme } from '../../src/theme';

// Fallback color for tasks that don't have a category. Sits on the muted
// gray axis of the design palette so it doesn't compete with real category
// colors in the donut.
const UNCATEGORIZED_COLOR = '#9a8f81';

export default function ProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const { state, signOut } = useAuth();
  // We need the full task history to compute streaks + breakdowns, so
  // status: 'all' and no category filter.
  const { tasks } = useTasks({ status: 'all' });
  const { categories } = useCategories();

  const categoriesById = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    for (const c of categories) {
      m.set(c.id, { name: c.name, color: c.color ?? UNCATEGORIZED_COLOR });
    }
    return m;
  }, [categories]);

  const totals = useMemo(() => computeOverviewTotals(tasks), [tasks]);
  const streak = useMemo(() => computeStreakStats(tasks), [tasks]);
  const weekly = useMemo(() => computeWeeklyCompletion(tasks), [tasks]);
  const upcoming = useMemo(() => computeUpcomingWeek(tasks), [tasks]);
  const breakdown = useMemo(() => computeCategoryBreakdown(tasks), [tasks]);

  const donutSlices: DonutSlice[] = useMemo(
    () =>
      breakdown.map((slice) => {
        const cat = slice.categoryId ? categoriesById.get(slice.categoryId) : null;
        return {
          id: slice.categoryId ?? '__none',
          label: cat?.name ?? 'No Category',
          color: cat?.color ?? UNCATEGORIZED_COLOR,
          value: slice.count,
        };
      }),
    [breakdown, categoriesById]
  );

  const user = state.status === 'signed-in' ? state.user : null;

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

      // We log size_bytes (not contents) so we can sanity-check whether
      // backups are growing as users accumulate data, without sending the
      // backup itself anywhere.
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
                await scheduler.reconcileAll();
                void analytics.track('backup_imported', { size_bytes: json.length });
                Alert.alert('Import complete', 'Your local data has been restored from the backup file.');
              } catch (error) {
                Alert.alert(
                  'Import failed',
                  error instanceof Error ? error.message : 'The selected backup file is invalid.'
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.color.background }]} edges={['top']}>
      <ScrollView
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
        <Text
          style={{
            color: t.color.textPrimary,
            fontSize: t.fontSize['3xl'],
            fontWeight: t.fontWeight.heavy,
            letterSpacing: t.tracking.tight,
            paddingBottom: t.spacing.xs,
          }}
        >
          Profile
        </Text>

        {user ? (
          <View
            style={[
              styles.userBar,
              {
                backgroundColor: t.color.surface,
                borderRadius: t.radius.xl,
                padding: t.spacing.md,
              },
            ]}
          >
            {user.photo ? (
              <Image
                source={{ uri: user.photo }}
                style={[styles.avatar, { backgroundColor: t.color.surfaceMuted }]}
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.avatarFallback,
                  { backgroundColor: t.color.surfaceMuted },
                ]}
              >
                <Text style={{ color: t.color.textPrimary, fontWeight: t.fontWeight.bold }}>
                  {user.name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: t.fontSize.base,
                  fontWeight: t.fontWeight.bold,
                  color: t.color.textPrimary,
                }}
              >
                {user.name ?? 'Signed in'}
              </Text>
              <Text style={{ fontSize: t.fontSize.sm, color: t.color.textSecondary }}>
                {user.email}
              </Text>
            </View>
          </View>
        ) : null}

        <OverviewTotals totals={totals} />

        <StreakCounter stats={streak} />

        <Section title="This week">
          <BarChart bars={weekly} />
        </Section>

        <UpcomingWeek days={upcoming} />

        <Section title="Categories">
          <DonutChart slices={donutSlices} />
        </Section>

        <ThemeToggle />

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
                Paste backup JSON and replace the current local dataset.
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

        {/* Sign-out is only meaningful for signed-in users. Guests upgrade
            instead — they're shown a "Sign in" entry that routes back to
            the sign-in screen, where the same Google button lives. The
            Sign-In screen already handles the guest → signed-in upgrade
            inside `signIn` so guest preference is cleared automatically. */}
        {state.status === 'signed-in' ? (
          <Pressable
            onPress={signOut}
            style={({ pressed }) => [
              styles.signOut,
              {
                backgroundColor: pressed ? t.color.surfaceMuted : t.color.surface,
                borderRadius: t.radius.xl,
                padding: t.spacing.lg,
                marginTop: t.spacing.md,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text
              style={{
                color: t.color.danger,
                fontSize: t.fontSize.md,
                fontWeight: t.fontWeight.semibold,
                textAlign: 'center',
              }}
            >
              Sign out
            </Text>
          </Pressable>
        ) : state.status === 'guest' ? (
          <Pressable
            onPress={signOut}
            style={({ pressed }) => [
              styles.signOut,
              {
                backgroundColor: pressed ? t.color.surfaceMuted : t.color.surface,
                borderRadius: t.radius.xl,
                padding: t.spacing.lg,
                marginTop: t.spacing.md,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Sign in to your account"
            accessibilityHint="Returns to the sign-in screen so you can attach a Google account"
          >
            <Text
              style={{
                color: t.color.accent,
                fontSize: t.fontSize.md,
                fontWeight: t.fontWeight.semibold,
                textAlign: 'center',
              }}
            >
              Sign in to your account
            </Text>
          </Pressable>
        ) : null}

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

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {},
  userBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOut: {
    width: '100%',
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
