import { StyleSheet, Text, View } from 'react-native';
import type { WeeklyBar } from '../../lib/streakStats';
import { useTheme } from '../../theme';

type BarChartProps = {
  bars: WeeklyBar[];
  /** Pixel height of the tallest bar (max value column). */
  height?: number;
};

// Pure-View bar chart per design-system/preview/chart-bar.html. No SVG —
// the layout is a flex row with each bar an absolute-height View. Three
// bar variants:
//   - filled    accent fill, completed days
//   - today     surfaceMuted fill + dashed accent border, today's bar
//   - empty     surfaceMuted fill, days with no completion (past or upcoming)
export function BarChart({ bars, height = 120 }: BarChartProps) {
  const t = useTheme();

  // Find the max so the tallest column reaches the full height.
  const max = Math.max(1, ...bars.map((b) => b.completed));

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.color.surface,
          borderRadius: t.radius.xl,
          padding: t.spacing.lg,
        },
      ]}
    >
      <View style={[styles.bars, { height }]}>
        {bars.map((bar) => {
          const ratio = max > 0 ? bar.completed / max : 0;
          // A minimum visible height so empty days show as a thin bar instead
          // of an invisible line, matching the design's `height:8%` example.
          const barHeight = bar.completed > 0
            ? Math.max(8, Math.round(ratio * height))
            : 8;

          let fill: 'filled' | 'today' | 'empty';
          if (bar.isToday) fill = 'today';
          else if (bar.completed > 0) fill = 'filled';
          else fill = 'empty';

          return (
            <View key={bar.ts} style={styles.column}>
              <View style={styles.barWrap}>
                <View
                  style={[
                    styles.bar,
                    { height: barHeight },
                    fill === 'filled' && {
                      backgroundColor: t.color.accent,
                    },
                    fill === 'today' && {
                      backgroundColor: t.color.surfaceMuted,
                      borderColor: t.color.accent,
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                    },
                    fill === 'empty' && {
                      backgroundColor: t.color.surfaceMuted,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      <View style={[styles.axis, { marginTop: t.spacing.sm }]}>
        {bars.map((bar) => (
          <Text
            key={bar.ts}
            style={{
              flex: 1,
              textAlign: 'center',
              color: bar.isToday ? t.color.accent : t.color.textMuted,
              fontSize: t.fontSize.xs,
              fontWeight: bar.isToday ? t.fontWeight.semibold : t.fontWeight.regular,
              fontVariant: ['tabular-nums'],
              opacity: bar.isUpcoming ? 0.6 : 1,
            }}
          >
            {bar.shortLabel}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  column: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
  },
  barWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
