/**
 * Custom repeat editor.
 *
 * Opened from the RepeatPopover when the user picks "Custom…". Surfaces the
 * underlying repeat fields the schema already supports (intervalN, byWeekday,
 * untilAt) but the simple-preset popover doesn't expose. Confirms back to the
 * caller as a `RepeatDraft` with `preset: 'custom'`.
 *
 * Scope cut for V0:
 *   - frequency unit (daily/weekly/monthly/yearly)
 *   - intervalN  (every N {units})
 *   - weekly: multi-weekday picker
 *   - optional end-date (untilAt)
 *
 * Day-of-month and month overrides are NOT exposed yet — they default from
 * the task's anchor date. Add later if a real user asks.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CalendarGrid } from './CalendarGrid';
import { Icon } from './Icon';
import { useTheme } from '../theme';
import {
  formatDayOfMonthOrdinal,
  MONTH_SHORT,
  startOfDay,
  startOfMonth,
} from '../lib/date';
import {
  DEFAULT_REPEAT,
  type CustomRepeatBody,
  type RepeatDraft,
} from './scheduleTypes';

type CustomRepeatSheetProps = {
  visible: boolean;
  /** The task's due date — used to label "every month on the Nth" etc. */
  anchorDate: number | null;
  /** Current draft. If preset !== 'custom' we still seed sensible defaults
   *  from it so the editor opens from where the user was. */
  current: RepeatDraft;
  onCancel: () => void;
  onConfirm: (next: RepeatDraft) => void;
};

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const FREQ_UNITS: ReadonlyArray<{ key: CustomRepeatBody['freq']; label: string; unit: string }> = [
  { key: 'daily', label: 'Daily', unit: 'day' },
  { key: 'weekly', label: 'Weekly', unit: 'week' },
  { key: 'monthly', label: 'Monthly', unit: 'month' },
  { key: 'yearly', label: 'Yearly', unit: 'year' },
];

const MAX_INTERVAL = 99;

function deriveSeed(current: RepeatDraft, anchorDate: number | null): {
  body: CustomRepeatBody;
  untilAt: number | null;
} {
  // Already-custom drafts seed directly from their body.
  if (current.preset === 'custom' && current.custom) {
    return { body: { ...current.custom }, untilAt: current.untilAt ?? null };
  }
  // For non-custom presets, seed from the preset so the user feels like they
  // opened "the same rule" with extra knobs available.
  const anchorWeekday = anchorDate !== null ? new Date(anchorDate).getDay() : 1;
  // current.preset is 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' here
  // (we already returned for the 'custom' branch). Narrow to the 4 units.
  const presetFreq: CustomRepeatBody['freq'] =
    current.preset === 'none' || current.preset === 'custom'
      ? 'weekly'
      : current.preset;
  return {
    body: {
      freq: presetFreq,
      intervalN: 1,
      byWeekday:
        presetFreq === 'weekly' ? WEEKDAY_CODES[anchorWeekday] : undefined,
    },
    untilAt: current.untilAt ?? null,
  };
}

function parseWeekdayCsv(csv: string | undefined): Set<number> {
  if (!csv) return new Set();
  const out = new Set<number>();
  for (const code of csv.split(',')) {
    const idx = WEEKDAY_CODES.indexOf(code.trim() as typeof WEEKDAY_CODES[number]);
    if (idx >= 0) out.add(idx);
  }
  return out;
}

function weekdayCsv(set: Set<number>): string | undefined {
  if (set.size === 0) return undefined;
  return [...set]
    .sort((a, b) => a - b)
    .map((i) => WEEKDAY_CODES[i])
    .join(',');
}

export function CustomRepeatSheet({
  visible,
  anchorDate,
  current,
  onCancel,
  onConfirm,
}: CustomRepeatSheetProps) {
  const t = useTheme();

  const [freq, setFreq] = useState<CustomRepeatBody['freq']>('weekly');
  const [intervalN, setIntervalN] = useState<number>(1);
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set());
  const [untilAt, setUntilAt] = useState<number | null>(null);
  const [untilPickerOpen, setUntilPickerOpen] = useState(false);
  const [untilMonth, setUntilMonth] = useState<number>(() => startOfMonth());

  // Re-seed every time the sheet becomes visible.
  useEffect(() => {
    if (!visible) return;
    const seed = deriveSeed(current, anchorDate);
    setFreq(seed.body.freq);
    setIntervalN(Math.max(1, Math.min(MAX_INTERVAL, seed.body.intervalN)));
    setWeekdays(parseWeekdayCsv(seed.body.byWeekday));
    setUntilAt(seed.untilAt);
    setUntilPickerOpen(false);
    // Seed the calendar's visible month: prefer the saved untilAt, else the
    // task's anchor date (so a task scheduled months out doesn't show this
    // month's grid by default), else fall back to the current month.
    if (seed.untilAt !== null) {
      setUntilMonth(startOfMonth(seed.untilAt));
    } else if (anchorDate !== null) {
      setUntilMonth(startOfMonth(anchorDate));
    } else {
      setUntilMonth(startOfMonth());
    }
  }, [visible, current, anchorDate]);

  const unitLabel = useMemo(() => FREQ_UNITS.find((f) => f.key === freq)?.unit ?? 'unit', [freq]);

  const toggleWeekday = (idx: number) => {
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        // Don't allow zero-weekday weekly rule — it would never spawn.
        if (next.size === 1 && freq === 'weekly') return prev;
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const summary = useMemo(() => {
    const every = intervalN === 1 ? '' : `${intervalN} `;
    const unit = intervalN === 1 ? unitLabel : `${unitLabel}s`;
    let s = `Every ${every}${unit}`.trim();
    if (freq === 'weekly' && weekdays.size > 0 && weekdays.size < 7) {
      const days = [...weekdays]
        .sort((a, b) => a - b)
        .map((i) => WEEKDAY_LETTERS[i])
        .join('·');
      s += ` on ${days}`;
    }
    if (freq === 'monthly' && anchorDate !== null) {
      s += ` on the ${formatDayOfMonthOrdinal(new Date(anchorDate).getDate())}`;
    }
    if (freq === 'yearly' && anchorDate !== null) {
      const d = new Date(anchorDate);
      s += ` on ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
    }
    if (untilAt !== null) {
      const d = new Date(untilAt);
      s += `, until ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
    }
    return s;
  }, [freq, intervalN, weekdays, untilAt, anchorDate, unitLabel]);

  const handleConfirm = () => {
    const body: CustomRepeatBody = {
      freq,
      intervalN: Math.max(1, Math.min(MAX_INTERVAL, intervalN)),
      byWeekday: freq === 'weekly' ? weekdayCsv(weekdays) : undefined,
    };
    onConfirm({
      preset: 'custom',
      custom: body,
      untilAt,
    });
  };

  const handleClear = () => {
    // "Clear" means no repeat at all — cancel out of custom entirely.
    onConfirm({ ...DEFAULT_REPEAT });
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.scrim, { backgroundColor: t.color.scrim }]}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Close custom repeat editor"
      />
      <View style={styles.center} pointerEvents="box-none">
        <View
          style={[
            styles.card,
            {
              backgroundColor: t.color.surfaceRaised,
              borderColor: t.color.border,
              borderRadius: t.radius['2xl'],
              paddingTop: t.spacing.lg,
              paddingBottom: t.spacing.md,
              paddingHorizontal: t.spacing['2xl'],
            },
          ]}
        >
          <Text
            style={{
              color: t.color.textPrimary,
              fontSize: t.fontSize.lg,
              fontWeight: t.fontWeight.bold,
              marginBottom: t.spacing.md,
            }}
          >
            Custom repeat
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            {/* Frequency unit */}
            <Text style={[styles.sectionLabel, { color: t.color.textMuted, letterSpacing: t.tracking.wider }]}>
              FREQUENCY
            </Text>
            <View
              style={[
                styles.segmented,
                {
                  backgroundColor: t.color.surfaceMuted,
                  borderRadius: t.radius.lg,
                  padding: 4,
                  marginBottom: t.spacing.md,
                },
              ]}
            >
              {FREQ_UNITS.map((opt) => {
                const active = freq === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setFreq(opt.key)}
                    style={[
                      styles.segment,
                      {
                        backgroundColor: active ? t.color.surface : 'transparent',
                        borderRadius: t.radius.md,
                        ...(active ? t.elevation.sm : null),
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={opt.label}
                  >
                    <Text
                      style={{
                        color: active ? t.color.textPrimary : t.color.textMuted,
                        fontSize: t.fontSize.sm,
                        fontWeight: active ? t.fontWeight.semibold : t.fontWeight.medium,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Interval stepper */}
            <Text style={[styles.sectionLabel, { color: t.color.textMuted, letterSpacing: t.tracking.wider }]}>
              EVERY
            </Text>
            <View
              style={[
                styles.stepperRow,
                {
                  backgroundColor: t.color.surfaceMuted,
                  borderRadius: t.radius.lg,
                  padding: 6,
                  marginBottom: t.spacing.md,
                },
              ]}
            >
              <Pressable
                onPress={() => setIntervalN((n) => Math.max(1, n - 1))}
                disabled={intervalN <= 1}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Decrease interval"
                style={({ pressed }) => [
                  styles.stepperBtn,
                  {
                    backgroundColor: pressed ? t.color.surface : 'transparent',
                    borderRadius: t.radius.md,
                    opacity: intervalN <= 1 ? 0.4 : 1,
                  },
                ]}
              >
                <Text style={{ color: t.color.textPrimary, fontSize: t.fontSize.lg, fontWeight: t.fontWeight.bold }}>−</Text>
              </Pressable>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text
                  style={{
                    color: t.color.textPrimary,
                    fontSize: t.fontSize.lg,
                    fontWeight: t.fontWeight.bold,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {intervalN}
                </Text>
                <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.xs, marginTop: 2 }}>
                  {intervalN === 1 ? unitLabel : `${unitLabel}s`}
                </Text>
              </View>
              <Pressable
                onPress={() => setIntervalN((n) => Math.min(MAX_INTERVAL, n + 1))}
                disabled={intervalN >= MAX_INTERVAL}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Increase interval"
                style={({ pressed }) => [
                  styles.stepperBtn,
                  {
                    backgroundColor: pressed ? t.color.surface : 'transparent',
                    borderRadius: t.radius.md,
                    opacity: intervalN >= MAX_INTERVAL ? 0.4 : 1,
                  },
                ]}
              >
                <Text style={{ color: t.color.textPrimary, fontSize: t.fontSize.lg, fontWeight: t.fontWeight.bold }}>+</Text>
              </Pressable>
            </View>

            {/* Weekday picker — weekly only */}
            {freq === 'weekly' ? (
              <>
                <Text style={[styles.sectionLabel, { color: t.color.textMuted, letterSpacing: t.tracking.wider }]}>
                  ON
                </Text>
                <View style={[styles.weekdayRow, { marginBottom: t.spacing.md }]}>
                  {WEEKDAY_LETTERS.map((letter, idx) => {
                    const active = weekdays.has(idx);
                    return (
                      <Pressable
                        key={`${idx}-${letter}`}
                        onPress={() => toggleWeekday(idx)}
                        style={[
                          styles.weekdayCell,
                          {
                            backgroundColor: active ? t.color.accent : t.color.surfaceMuted,
                            borderRadius: 999,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Weekday ${idx}`}
                      >
                        <Text
                          style={{
                            color: active ? t.color.textOnAccent : t.color.textPrimary,
                            fontSize: t.fontSize.sm,
                            fontWeight: t.fontWeight.semibold,
                          }}
                        >
                          {letter}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {/* End date toggle + picker */}
            <Text style={[styles.sectionLabel, { color: t.color.textMuted, letterSpacing: t.tracking.wider }]}>
              ENDS
            </Text>
            <Pressable
              onPress={() => {
                if (untilAt !== null) {
                  setUntilAt(null);
                  setUntilPickerOpen(false);
                } else {
                  setUntilPickerOpen((v) => !v);
                }
              }}
              style={({ pressed }) => [
                styles.endRow,
                {
                  backgroundColor: pressed ? t.color.surfaceMuted : 'transparent',
                  borderColor: t.color.border,
                  borderRadius: t.radius.md,
                  borderWidth: 1,
                  marginBottom: t.spacing.sm,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={untilAt !== null ? 'Clear end date' : 'Set end date'}
            >
              <Text
                style={{
                  flex: 1,
                  color: untilAt !== null ? t.color.textPrimary : t.color.textMuted,
                  fontSize: t.fontSize.md,
                  fontWeight: t.fontWeight.medium,
                }}
              >
                {untilAt !== null
                  ? `Until ${MONTH_SHORT[new Date(untilAt).getMonth()]} ${new Date(untilAt).getDate()}, ${new Date(untilAt).getFullYear()}`
                  : 'No end date'}
              </Text>
              {untilAt !== null ? (
                <Icon name="close" size={16} color={t.color.textMuted} />
              ) : (
                <Icon name="calendar" size={16} color={t.color.textMuted} />
              )}
            </Pressable>

            {untilPickerOpen && untilAt === null ? (
              <View style={{ marginBottom: t.spacing.md }}>
                <CalendarGrid
                  month={untilMonth}
                  onMonthChange={setUntilMonth}
                  selected={untilAt}
                  onSelect={(ts) => {
                    setUntilAt(startOfDay(ts));
                    setUntilPickerOpen(false);
                  }}
                  disablePast
                />
              </View>
            ) : null}

            {/* Live summary */}
            <View
              style={{
                backgroundColor: t.color.accentSoft,
                borderRadius: t.radius.md,
                paddingHorizontal: t.spacing.md,
                paddingVertical: t.spacing.sm,
                marginTop: t.spacing.sm,
                marginBottom: t.spacing.md,
              }}
            >
              <Text
                style={{
                  color: t.color.textPrimary,
                  fontSize: t.fontSize.sm,
                  fontWeight: t.fontWeight.semibold,
                }}
              >
                {summary}
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              onPress={handleClear}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear repeat"
            >
              <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.md, fontWeight: t.fontWeight.semibold }}>
                CLEAR
              </Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 24 }}>
              <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel">
                <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.md, fontWeight: t.fontWeight.semibold }}>
                  CANCEL
                </Text>
              </Pressable>
              <Pressable onPress={handleConfirm} hitSlop={8} accessibilityRole="button" accessibilityLabel="Done">
                <Text style={{ color: t.color.accent, fontSize: t.fontSize.md, fontWeight: t.fontWeight.bold }}>
                  DONE
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 4,
  },
  segmented: {
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  weekdayCell: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  endRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 4,
  },
});
