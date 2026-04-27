import { StyleSheet, Text, View } from 'react-native';
import type { UpcomingDay } from '../lib/streakStats';
import { useTheme } from '../theme';

type Props = {
  days: UpcomingDay[];
};

// Forward-looking strip of the next 7 days. Each cell shows the weekday
// letter and the count of pending tasks due that day. Days with zero are
// muted; "Tomorrow" gets a subtle accent border so it reads as the next
// thing on deck.
export function UpcomingWeek({ days }: Props) {
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
        Next 7 days
      </Text>

      <View style={styles.row}>
        {days.map((d) => {
          const hasWork = d.pending > 0;
          return (
            <View
              key={d.ts}
              style={[
                styles.cell,
                {
                  backgroundColor: hasWork ? t.color.surfaceMuted : 'transparent',
                  borderRadius: t.radius.md,
                  borderColor: d.isTomorrow ? t.color.accent : 'transparent',
                  borderWidth: d.isTomorrow ? 1 : 0,
                },
              ]}
              accessibilityLabel={`${d.longLabel}: ${d.pending} pending`}
            >
              <Text
                style={{
                  color: hasWork ? t.color.textMuted : t.color.textMuted,
                  fontSize: t.fontSize.xs,
                  fontWeight: t.fontWeight.medium,
                  opacity: hasWork ? 1 : 0.6,
                }}
              >
                {d.shortLabel}
              </Text>
              <Text
                style={{
                  color: hasWork ? t.color.textPrimary : t.color.textMuted,
                  fontSize: t.fontSize.lg,
                  fontWeight: t.fontWeight.bold,
                  fontVariant: ['tabular-nums'],
                  marginTop: 2,
                  opacity: hasWork ? 1 : 0.4,
                }}
              >
                {d.pending}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
});
