import { StyleSheet, Text, View } from 'react-native';
import type { StreakStats } from '../lib/streakStats';
import { useTheme } from '../theme';
import { Icon } from './Icon';

type StreakCounterProps = {
  stats: StreakStats;
};

// Honest streak counter per design-system/preview/streak-states.html.
//
// Five ring states:
//   - active + today completed → filled accent, white number
//   - active + today pending   → outlined accent, primary number
//   - no streak (no history)   → muted outline, em-dash
export function StreakCounter({ stats }: StreakCounterProps) {
  const t = useTheme();

  const ringState: 'filled' | 'outlined' | 'idle' = (() => {
    if (stats.current > 0) {
      return stats.todayCompleted ? 'filled' : 'outlined';
    }
    if (stats.todayHasDueTask) return 'outlined';
    return 'idle';
  })();

  const ringStyle = (() => {
    switch (ringState) {
      case 'filled':
        return {
          backgroundColor: t.color.warn,
          borderColor: t.color.warn,
          borderWidth: 3,
        };
      case 'outlined':
        return {
          backgroundColor: t.color.surface,
          borderColor: t.color.warn,
          borderWidth: 3,
        };
      case 'idle':
        return {
          backgroundColor: t.color.surface,
          borderColor: t.color.info,
          borderWidth: 3,
        };
    }
  })();

  const numberColor = (() => {
    switch (ringState) {
      case 'filled':
        return t.color.textInverse;
      case 'outlined':
        return t.color.textPrimary;
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
          backgroundColor: ringState === 'idle' ? t.color.infoSoft : t.color.warnSoft,
          borderRadius: t.radius['2xl'],
          padding: t.spacing.xl,
          ...t.elevation.sm,
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
        </View>
        <View style={styles.heroLabel}>
          <View style={styles.kicker}>
            <Icon name="flame" size={15} color={ringState === 'idle' ? t.color.info : t.color.warn} />
            <Text
              style={{
                color: t.color.textMuted,
                fontSize: t.fontSize.xs,
                fontWeight: t.fontWeight.bold,
                letterSpacing: t.tracking.wide,
              }}
            >
              STREAK SPARK
            </Text>
          </View>
          <Text
            style={{
              color: t.color.textPrimary,
              fontSize: t.fontSize.lg,
              fontWeight: t.fontWeight.bold,
            }}
          >
            {ringState === 'idle'
              ? 'Your streak starts here'
              : `${stats.current}-day streak`}
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
            backgroundColor: t.color.surface,
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

function captionForState(state: 'filled' | 'outlined' | 'idle', stats: StreakStats): string {
  switch (state) {
    case 'filled':
      return 'Today is done. Keep the spark glowing.';
    case 'outlined':
      if (stats.current === 0) return 'One finished task lights the first spark.';
      return stats.todayHasDueTask ? 'One more win keeps it alive.' : 'Rest day. Your streak is safe.';
    case 'idle':
      return 'Finish any task today to light it up.';
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
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroLabel: {
    flex: 1,
  },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  captionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
});
