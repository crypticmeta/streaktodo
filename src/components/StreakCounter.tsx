import { StyleSheet, Text, View } from 'react-native';
import type { StreakStats } from '../lib/streakStats';
import { useTheme } from '../theme';

type StreakCounterProps = {
  stats: StreakStats;
};

// Honest streak counter per design-system/preview/streak-states.html.
//
// Five ring states:
//   - active + today completed → filled accent, white number
//   - active + today pending   → outlined accent, primary number
//   - missed (current = 0 because today missed) → danger ring + strike + 0
//   - no streak (no history)   → muted outline, em-dash
export function StreakCounter({ stats }: StreakCounterProps) {
  const t = useTheme();

  const ringState: 'filled' | 'outlined' | 'broken' | 'idle' = (() => {
    // Today already missed → broken regardless of yesterday
    if (stats.todayHasDueTask && !stats.todayCompleted && stats.current === 0) {
      return 'broken';
    }
    if (stats.current > 0) {
      return stats.todayCompleted ? 'filled' : 'outlined';
    }
    return 'idle';
  })();

  const ringStyle = (() => {
    switch (ringState) {
      case 'filled':
        return {
          backgroundColor: t.color.accent,
          borderColor: t.color.accent,
          borderWidth: 2,
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderColor: t.color.accent,
          borderWidth: 2,
        };
      case 'broken':
        return {
          backgroundColor: 'transparent',
          borderColor: t.color.danger,
          borderWidth: 2,
        };
      case 'idle':
        return {
          backgroundColor: 'transparent',
          borderColor: t.color.borderStrong,
          borderWidth: 2,
        };
    }
  })();

  const numberColor = (() => {
    switch (ringState) {
      case 'filled':
        return t.color.textOnAccent;
      case 'outlined':
        return t.color.textPrimary;
      case 'broken':
        return t.color.danger;
      case 'idle':
        return t.color.textMuted;
    }
  })();

  const numberText = ringState === 'idle' ? '—' : String(stats.current);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: t.color.surface,
          borderRadius: t.radius.xl,
          padding: t.spacing.xl,
        },
      ]}
    >
      <View style={styles.heroRow}>
        <View style={[styles.ring, ringStyle]}>
          <Text
            style={{
              color: numberColor,
              fontSize: 26,
              fontWeight: t.fontWeight.bold,
              fontVariant: ['tabular-nums'],
              letterSpacing: -0.5,
            }}
          >
            {numberText}
          </Text>
          {ringState === 'broken' ? (
            <View
              style={[
                styles.strike,
                { backgroundColor: t.color.danger },
              ]}
            />
          ) : null}
        </View>
        <View style={styles.heroLabel}>
          <Text
            style={{
              color: t.color.textPrimary,
              fontSize: t.fontSize.lg,
              fontWeight: t.fontWeight.bold,
            }}
          >
            {ringState === 'idle' ? 'No streak yet' : `${stats.current} day streak`}
          </Text>
          <Text
            style={{
              color: t.color.textMuted,
              fontSize: t.fontSize.sm,
              marginTop: 2,
            }}
          >
            {captionForState(ringState, stats)}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.captionRow,
          {
            backgroundColor: t.color.surfaceMuted,
            borderRadius: t.radius.md,
            padding: t.spacing.md,
            marginTop: t.spacing.lg,
          },
        ]}
      >
        <Caption label="current" value={`${stats.current} days`} />
        <Caption label="best" value={`${stats.best} days`} />
        <Caption
          label="missed this month"
          value={String(stats.missedThisMonth)}
          danger={stats.missedThisMonth > 0}
        />
      </View>
    </View>
  );
}

function captionForState(state: 'filled' | 'outlined' | 'broken' | 'idle', stats: StreakStats): string {
  switch (state) {
    case 'filled':
      return 'today done — keep it going.';
    case 'outlined':
      return stats.todayHasDueTask
        ? "today's not done yet."
        : 'no task due today, streak holds.';
    case 'broken':
      return 'today missed. start again tomorrow.';
    case 'idle':
      return 'finish a task with a date to start a streak.';
  }
}

function Caption({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ flexShrink: 1 }}>
      <Text
        style={{
          color: t.color.textMuted,
          fontSize: t.fontSize.xs,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: danger ? t.color.danger : t.color.textPrimary,
          fontSize: t.fontSize.sm,
          fontWeight: t.fontWeight.semibold,
          fontVariant: ['tabular-nums'],
          marginTop: 2,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ring: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  strike: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: '50%',
    height: 2,
    transform: [{ translateY: -1 }, { rotate: '-12deg' }],
    borderRadius: 1,
  },
  heroLabel: {
    flex: 1,
  },
  captionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
});
