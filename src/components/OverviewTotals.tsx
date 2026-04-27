import { StyleSheet, Text, View } from 'react-native';
import type { OverviewTotals as Totals } from '../lib/streakStats';
import { useTheme } from '../theme';

type Props = {
  totals: Totals;
};

export function OverviewTotals({ totals }: Props) {
  const t = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: t.color.surface,
          borderRadius: t.radius.xl,
          padding: t.spacing.xl,
          gap: t.spacing.md,
        },
      ]}
    >
      <Text
        style={{
          color: t.color.textMuted,
          fontSize: t.fontSize.xs,
          fontWeight: t.fontWeight.semibold,
          letterSpacing: t.tracking.wide,
          textTransform: 'uppercase',
        }}
      >
        Overview
      </Text>

      <View style={styles.grid}>
        <Stat label="total" value={totals.total} />
        <Stat label="done" value={totals.done} accent />
        <Stat label="pending" value={totals.pending} />
        <Stat label="overdue" value={totals.overdue} danger={totals.overdue > 0} />
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: number;
  accent?: boolean;
  danger?: boolean;
}) {
  const t = useTheme();
  const color = danger
    ? t.color.danger
    : accent
      ? t.color.accent
      : t.color.textPrimary;
  return (
    <View style={styles.cell}>
      <Text
        style={{
          color,
          fontSize: t.fontSize['2xl'],
          fontWeight: t.fontWeight.heavy,
          fontVariant: ['tabular-nums'],
          letterSpacing: t.tracking.tight,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: t.color.textMuted,
          fontSize: t.fontSize.xs,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cell: {
    flex: 1,
  },
});
