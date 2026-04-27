import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { branding } from '../../branding';
import { BarChart } from '../../src/components/charts/BarChart';
import { DonutChart, type DonutSlice } from '../../src/components/charts/DonutChart';
import { Icon } from '../../src/components/Icon';
import { OverviewTotals } from '../../src/components/OverviewTotals';
import { StreakCounter } from '../../src/components/StreakCounter';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { UpcomingWeek } from '../../src/components/UpcomingWeek';
import { useCategories, useTasks } from '../../src/db';
import { useAuth } from '../../src/lib/auth';
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

        {__DEV__ ? (
          <Pressable
            onPress={() => router.push('/notifications')}
            style={({ pressed }) => [
              styles.manageRow,
              {
                backgroundColor: pressed ? t.color.surfaceMuted : t.color.surface,
                borderRadius: t.radius.xl,
                padding: t.spacing.lg,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Notification test (dev only)"
          >
            <Icon name="reminder" size={18} color={t.color.textPrimary} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontSize: t.fontSize.md,
                  fontWeight: t.fontWeight.semibold,
                }}
              >
                Notification test
              </Text>
              <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.xs, marginTop: 2 }}>
                Dev-only · trigger a local notification
              </Text>
            </View>
            <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.lg }}>›</Text>
          </Pressable>
        ) : null}

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
});
