import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme';

export type DonutSlice = {
  /** Stable id, used for React keys. */
  id: string;
  /** Display label in the legend ("Work", "No Category", …). */
  label: string;
  /** Slice color. Caller resolves the user's category color so we don't
   *  need to know about category data here. */
  color: string;
  /** Raw count — relative weight. Sum across slices = 100%. */
  value: number;
};

type DonutChartProps = {
  slices: ReadonlyArray<DonutSlice>;
  /** Diameter in pixels. Stroke width follows. */
  size?: number;
};

// SVG donut per design-system/preview/chart-donut.html. The track is
// surfaceMuted; each slice is an arc rendered via stroke-dasharray on a
// circle, rotated -90deg so the first slice starts at the top.
export function DonutChart({ slices, size = 160 }: DonutChartProps) {
  const t = useTheme();

  // Geometry: viewBox is 0..100; slice arcs sit on a circle radius 38 so
  // the circumference is 2π·38 ≈ 238.76. Each slice's dasharray is
  // [arcLength, total - arcLength] and dashoffset starts where the
  // previous slice ended (negated, since SVG rotates negative).
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = 14;

  const total = slices.reduce((s, x) => s + x.value, 0);

  // Compute cumulative offsets.
  let cumulative = 0;
  const arcs = slices.map((slice) => {
    const ratio = total > 0 ? slice.value / total : 0;
    const arc = ratio * circumference;
    const dash = `${arc} ${circumference - arc}`;
    const offset = -cumulative;
    cumulative += arc;
    return { ...slice, dash, offset, percent: Math.round(ratio * 100) };
  });

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
      <View style={styles.row}>
        <View style={{ width: size, height: size }}>
          <Svg viewBox="0 0 100 100" width={size} height={size}>
            {/* Track */}
            <Circle
              cx={50}
              cy={50}
              r={radius}
              fill="none"
              stroke={t.color.surfaceMuted}
              strokeWidth={strokeWidth}
            />
            {/* Slices — only render if there is at least one with a value */}
            {total > 0
              ? arcs.map((arc) => (
                  <Circle
                    key={arc.id}
                    cx={50}
                    cy={50}
                    r={radius}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={arc.dash}
                    strokeDashoffset={arc.offset}
                    transform="rotate(-90 50 50)"
                  />
                ))
              : null}
          </Svg>
          {/* Center total */}
          <View style={[StyleSheet.absoluteFillObject, styles.center]}>
            <Text
              style={{
                color: t.color.textPrimary,
                fontSize: 28,
                fontWeight: t.fontWeight.bold,
                fontVariant: ['tabular-nums'],
                letterSpacing: -0.5,
              }}
            >
              {total}
            </Text>
            <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.xs, marginTop: 2 }}>
              tasks
            </Text>
          </View>
        </View>

        <View style={[styles.legend, { marginLeft: t.spacing.lg }]}>
          {arcs.length === 0 ? (
            <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.sm }}>
              No tasks yet
            </Text>
          ) : (
            arcs.map((arc) => (
              <View key={arc.id} style={styles.legendRow}>
                <View style={styles.legendName}>
                  <View style={[styles.swatch, { backgroundColor: arc.color }]} />
                  <Text style={{ color: t.color.textPrimary, fontSize: t.fontSize.sm }} numberOfLines={1}>
                    {arc.label}
                  </Text>
                </View>
                <Text
                  style={{
                    color: t.color.textPrimary,
                    fontSize: t.fontSize.sm,
                    fontWeight: t.fontWeight.semibold,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {arc.percent}
                  <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.xs }}>%</Text>
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  legend: { flex: 1, gap: 8 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  legendName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  swatch: { width: 10, height: 10, borderRadius: 5 },
});
