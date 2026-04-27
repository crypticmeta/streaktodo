import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  addMonths,
  daysInMonth,
  isSameDay,
  MONTH_SHORT,
  startOfDay,
  startOfMonth,
  WEEKDAY_SHORT,
} from '../lib/date';
import { useTheme } from '../theme';

type CalendarGridProps = {
  /** Currently displayed month (any timestamp within it). */
  month: number;
  onMonthChange: (next: number) => void;
  /** Currently selected day (any timestamp within the day). null = none. */
  selected: number | null;
  onSelect: (dayStartTs: number) => void;
};

type Cell = {
  ts: number;
  inMonth: boolean;
};

// Build a 6×7 cell matrix for the given month, padded with leading/trailing
// days from the surrounding months. Sunday-start, matching the inspiration.
function buildCells(monthTs: number): Cell[] {
  const first = startOfMonth(monthTs);
  const firstDay = new Date(first).getDay(); // 0..6 (Sun..Sat)
  const days = daysInMonth(monthTs);

  const cells: Cell[] = [];

  // Leading days from previous month.
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = new Date(first);
    d.setDate(d.getDate() - i - 1);
    cells.push({ ts: d.getTime(), inMonth: false });
  }

  // Current month.
  for (let day = 1; day <= days; day++) {
    const d = new Date(first);
    d.setDate(day);
    cells.push({ ts: d.getTime(), inMonth: true });
  }

  // Trailing days to fill 42 cells (6 weeks).
  let trail = 1;
  while (cells.length < 42) {
    const d = new Date(first);
    d.setMonth(d.getMonth() + 1);
    d.setDate(trail++);
    cells.push({ ts: d.getTime(), inMonth: false });
  }

  return cells;
}

export function CalendarGrid({ month, onMonthChange, selected, onSelect }: CalendarGridProps) {
  const t = useTheme();
  const cells = useMemo(() => buildCells(month), [month]);
  const today = startOfDay();

  const monthLabel = useMemo(() => {
    const d = new Date(month);
    return `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`.toUpperCase();
  }, [month]);

  return (
    <View>
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => onMonthChange(addMonths(month, -1))}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          style={styles.navButton}
        >
          <Text style={{ color: t.color.textSecondary, fontSize: t.fontSize.lg }}>‹</Text>
        </Pressable>
        <Text
          style={{
            color: t.color.textPrimary,
            fontSize: t.fontSize.md,
            fontWeight: t.fontWeight.semibold,
            letterSpacing: t.tracking.wide,
          }}
        >
          {monthLabel}
        </Text>
        <Pressable
          onPress={() => onMonthChange(addMonths(month, 1))}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={styles.navButton}
        >
          <Text style={{ color: t.color.textSecondary, fontSize: t.fontSize.lg }}>›</Text>
        </Pressable>
      </View>

      {/* Weekday header */}
      <View style={styles.weekdayRow}>
        {WEEKDAY_SHORT.map((w) => (
          <Text
            key={w}
            style={[
              styles.weekdayLabel,
              { color: t.color.textPrimary, fontWeight: t.fontWeight.bold },
            ]}
          >
            {w}
          </Text>
        ))}
      </View>

      {/* Day grid */}
      <View style={styles.grid}>
        {cells.map((cell) => {
          const isSelected = selected !== null && isSameDay(cell.ts, selected);
          const isToday = isSameDay(cell.ts, today);
          // Past days are non-tappable: the user can still navigate to a past
          // month for context, but they can't choose a date earlier than today
          // for a new task.
          const isPast = startOfDay(cell.ts) < today;
          const day = new Date(cell.ts).getDate();

          let textColor = t.color.textPrimary;
          if (!cell.inMonth) textColor = t.color.textMuted;
          if (isPast) textColor = t.color.textMuted;
          if (isSelected) textColor = t.color.textOnAccent;
          if (isToday && !isSelected) textColor = t.color.accent;

          return (
            <Pressable
              key={cell.ts}
              onPress={() => !isPast && onSelect(startOfDay(cell.ts))}
              hitSlop={2}
              disabled={isPast}
              style={({ pressed }) => [
                styles.cell,
                isSelected && { backgroundColor: t.color.accent },
                !isSelected && !isPast && pressed && {
                  backgroundColor: t.color.surfaceMuted,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: isPast }}
            >
              <Text
                style={{
                  color: textColor,
                  fontSize: t.fontSize.md,
                  fontWeight: isToday || isSelected ? t.fontWeight.semibold : t.fontWeight.regular,
                  opacity: !cell.inMonth ? 0.45 : isPast ? 0.35 : 1,
                  textDecorationLine: isPast ? 'line-through' : 'none',
                }}
              >
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const CELL_SIZE = 40;

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  navButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  weekdayLabel: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CELL_SIZE / 2,
    marginBottom: 2,
  },
});
