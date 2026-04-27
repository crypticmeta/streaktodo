import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  addDays,
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
  /** Currently displayed anchor (any timestamp within the visible window). */
  month: number;
  /**
   * Called when the user taps the prev/next arrow. The new value advances
   * by one month in `'month'` mode and by 7 days in `'week'` mode.
   */
  onMonthChange: (next: number) => void;
  /** Currently selected day (any timestamp within the day). null = none. */
  selected: number | null;
  onSelect: (dayStartTs: number) => void;
  /**
   * Days that should render a marker dot under the number (e.g. days that
   * have tasks). Set of start-of-day epoch ms.
   */
  markedDays?: ReadonlySet<number>;
  /**
   * Block selecting any day strictly before today. Defaults to true so the
   * SchedulePickerSheet keeps its old behaviour; the Calendar tab passes
   * false because browsing past days is fine when reviewing history.
   */
  disablePast?: boolean;
  /**
   * `'month'` (default) renders the full 6×7 grid. `'week'` renders only the
   * single 7-cell row containing `selected` (or `month` if no selection),
   * and the prev/next arrows step by 7 days instead of by month. Lets the
   * caller hand more vertical space to a day-list below the grid.
   */
  mode?: 'month' | 'week';
};

type Cell = {
  ts: number;
  inMonth: boolean;
};

// Build a 6×7 cell matrix for the given month, padded with leading/trailing
// days from the surrounding months. Sunday-start, matching the inspiration.
function buildMonthCells(monthTs: number): Cell[] {
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

// Build 7 cells for the week containing `anchorTs`. Sunday-start. `inMonth`
// is computed against `anchorTs`'s month so the surrounding days dim
// consistently with month mode.
function buildWeekCells(anchorTs: number): Cell[] {
  const anchor = startOfDay(anchorTs);
  const dayOfWeek = new Date(anchor).getDay(); // 0..6 (Sun..Sat)
  const sunday = addDays(anchor, -dayOfWeek);
  const anchorMonth = new Date(anchor).getMonth();

  const cells: Cell[] = [];
  for (let i = 0; i < 7; i++) {
    const ts = addDays(sunday, i);
    const inMonth = new Date(ts).getMonth() === anchorMonth;
    cells.push({ ts, inMonth });
  }
  return cells;
}

export function CalendarGrid({
  month,
  onMonthChange,
  selected,
  onSelect,
  markedDays,
  disablePast = true,
  mode = 'month',
}: CalendarGridProps) {
  const t = useTheme();
  // In week mode, the visible week tracks the parent's anchor (`month`) so
  // that nav arrows actually advance the displayed week. The selected day
  // still highlights within the visible week if it falls inside it; if the
  // user navigates away, the selection just stops showing as highlighted —
  // we don't auto-move it, navigation and selection are distinct.
  const weekAnchor = month;
  const cells = useMemo(
    () => (mode === 'week' ? buildWeekCells(weekAnchor) : buildMonthCells(month)),
    [mode, weekAnchor, month]
  );
  const today = startOfDay();

  const headerLabel = useMemo(() => {
    if (mode === 'week') {
      const sunday = addDays(startOfDay(weekAnchor), -new Date(weekAnchor).getDay());
      const saturday = addDays(sunday, 6);
      const a = new Date(sunday);
      const b = new Date(saturday);
      const aLabel = `${MONTH_SHORT[a.getMonth()]} ${a.getDate()}`;
      const bLabel = a.getMonth() === b.getMonth()
        ? `${b.getDate()}`
        : `${MONTH_SHORT[b.getMonth()]} ${b.getDate()}`;
      return `${aLabel} — ${bLabel}`.toUpperCase();
    }
    const d = new Date(month);
    return `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`.toUpperCase();
  }, [mode, month, weekAnchor]);

  const stepBackward = () =>
    onMonthChange(mode === 'week' ? addDays(weekAnchor, -7) : addMonths(month, -1));
  const stepForward = () =>
    onMonthChange(mode === 'week' ? addDays(weekAnchor, 7) : addMonths(month, 1));

  return (
    <View>
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={stepBackward}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={mode === 'week' ? 'Previous week' : 'Previous month'}
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
          {headerLabel}
        </Text>
        <Pressable
          onPress={stepForward}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={mode === 'week' ? 'Next week' : 'Next month'}
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
          const dayStart = startOfDay(cell.ts);
          const isSelected = selected !== null && isSameDay(cell.ts, selected);
          const isToday = isSameDay(cell.ts, today);
          const isPast = dayStart < today;
          const isBlocked = disablePast && isPast;
          // Past-but-viewable: caller passed disablePast=false (e.g. the
          // calendar tab for history review). The day stays tappable but
          // visually de-emphasizes so it doesn't read as a future option.
          const isPastViewable = !disablePast && isPast;
          const isMarked = markedDays?.has(dayStart) ?? false;
          const day = new Date(cell.ts).getDate();

          let textColor = t.color.textPrimary;
          if (!cell.inMonth) textColor = t.color.textMuted;
          if (isBlocked) textColor = t.color.textMuted;
          if (isPastViewable) textColor = t.color.textMuted;
          if (isSelected) textColor = t.color.textOnAccent;
          if (isToday && !isSelected) textColor = t.color.accent;

          return (
            <Pressable
              key={cell.ts}
              onPress={() => !isBlocked && onSelect(dayStart)}
              hitSlop={2}
              disabled={isBlocked}
              style={({ pressed }) => [
                styles.cell,
                isSelected && { backgroundColor: t.color.accent },
                !isSelected && !isBlocked && pressed && {
                  backgroundColor: t.color.surfaceMuted,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: isBlocked }}
            >
              <Text
                style={{
                  color: textColor,
                  fontSize: t.fontSize.md,
                  fontWeight: isToday || isSelected ? t.fontWeight.semibold : t.fontWeight.regular,
                  opacity: !cell.inMonth
                    ? 0.45
                    : isBlocked
                      ? 0.35
                      : isPastViewable && !isSelected
                        ? 0.55
                        : 1,
                  textDecorationLine: isBlocked ? 'line-through' : 'none',
                }}
              >
                {day}
              </Text>
              {isMarked ? (
                <View
                  style={[
                    styles.marker,
                    {
                      backgroundColor: isSelected
                        ? t.color.textOnAccent
                        : t.color.accent,
                    },
                  ]}
                />
              ) : null}
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
  marker: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
