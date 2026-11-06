import { StyleSheet, Text, View } from 'react-native';
import type { OverviewTotals as Totals } from '../lib/streakStats';
import { useTheme } from '../theme';
import { Icon, type IconName } from './Icon';

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
        Momentum at a glance
      </Text>

      <View style={styles.grid}>
        <Stat label="All tasks" value={totals.total} tone="info" icon="sparkles" />
        <Stat label="Done" value={totals.done} tone="success" icon="check" />
        <Stat label="In motion" value={totals.pending} tone="warning" icon="time" />
        <Stat label="Overdue" value={totals.overdue} tone="danger" icon="reminder" />
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: 'info' | 'success' | 'warning' | 'danger';
  icon: IconName;
}) {
  const t = useTheme();
  const backgroundColor = tone === 'info'
    ? t.color.infoSoft
    : tone === 'success'
      ? t.color.successSoft
      : tone === 'warning'
        ? t.color.warnSoft
        : t.color.dangerSoft;
  const iconColor = tone === 'info'
    ? t.color.info
    : tone === 'success'
      ? t.color.success
      : tone === 'warning'
        ? t.color.warn
        : t.color.danger;
  return (
    <View style={[styles.cell, { backgroundColor, borderRadius: t.radius.xl, padding: t.spacing.lg }]}>
      <View style={styles.statTop}>
        <View style={[styles.iconBubble, { backgroundColor: t.color.surface, borderRadius: t.radius.pill }]}>
          <Icon name={icon} size={16} color={iconColor} />
        </View>
        <Text
          style={{
            color: t.color.textMuted,
            fontSize: t.fontSize.xs,
            fontWeight: t.fontWeight.semibold,
          }}
        >
          {label}
        </Text>
      </View>
      <Text
        style={{
          color: t.color.textPrimary,
          fontSize: t.fontSize['3xl'],
          fontWeight: t.fontWeight.heavy,
          fontVariant: ['tabular-nums'],
          letterSpacing: t.tracking.tight,
          marginTop: t.spacing.md,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 108,
  },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBubble: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
