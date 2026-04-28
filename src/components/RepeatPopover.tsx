import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatDayOfMonthOrdinal,
  MONTH_SHORT,
  WEEKDAY_LONG,
} from '../lib/date';
import { useTheme } from '../theme';
import type { RepeatDraft, RepeatPreset } from './scheduleTypes';

type RepeatPopoverProps = {
  visible: boolean;
  /** Date the repeat would anchor to (used to label "every month on the Nth" etc). */
  anchorDate: number | null;
  current: RepeatDraft;
  onClose: () => void;
  onSelect: (next: RepeatDraft) => void;
  /** Caller hook: user picked the "Custom…" row. The popover closes and the
   *  caller is expected to mount its own CustomRepeatSheet next. */
  onPickCustom: () => void;
};

type PresetOption = {
  preset: RepeatPreset;
  label: string;
};

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
const WEEKDAY_LETTER_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

function buildOptions(anchorDate: number | null): PresetOption[] {
  const d = anchorDate !== null ? new Date(anchorDate) : null;
  const weekday = d ? WEEKDAY_LONG[d.getDay()] : null;
  const dayOfMonth = d ? formatDayOfMonthOrdinal(d.getDate()) : null;
  const monthDay = d ? `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}` : null;

  return [
    { preset: 'none',    label: 'None' },
    { preset: 'daily',   label: 'Every day' },
    { preset: 'weekly',  label: weekday   ? `Every week on ${weekday}`        : 'Every week' },
    { preset: 'monthly', label: dayOfMonth ? `Every month on the ${dayOfMonth}` : 'Every month' },
    { preset: 'yearly',  label: monthDay  ? `Every year on ${monthDay}`        : 'Every year' },
  ];
}

/** Build a human label for a saved 'custom' rule so the popover row reads
 *  "Every 2 weeks on M·W·F" instead of just "Custom". */
function describeCustom(current: RepeatDraft): string {
  if (current.preset !== 'custom' || !current.custom) return 'Custom…';
  const { freq, intervalN, byWeekday } = current.custom;
  const unit = freq === 'daily' ? 'day' : freq === 'weekly' ? 'week' : freq === 'monthly' ? 'month' : 'year';
  const every = intervalN === 1 ? '' : `${intervalN} `;
  const unitLabel = intervalN === 1 ? unit : `${unit}s`;
  let s = `Every ${every}${unitLabel}`.trim();
  if (freq === 'weekly' && byWeekday) {
    const idxs = byWeekday
      .split(',')
      .map((c) => WEEKDAY_CODES.indexOf(c.trim() as typeof WEEKDAY_CODES[number]))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    if (idxs.length > 0 && idxs.length < 7) {
      s += ` on ${idxs.map((i) => WEEKDAY_LETTER_SHORT[i]).join('·')}`;
    }
  }
  return s;
}

export function RepeatPopover({
  visible,
  anchorDate,
  current,
  onClose,
  onSelect,
  onPickCustom,
}: RepeatPopoverProps) {
  const t = useTheme();
  const options = buildOptions(anchorDate);
  const customLabel = describeCustom(current);
  const customSelected = current.preset === 'custom';

  const choose = (preset: RepeatPreset) => {
    if (preset === 'custom') {
      // Special-case: custom routes through the editor sheet, not the
      // preset-only happy path.
      onClose();
      onPickCustom();
      return;
    }
    // Picking a non-custom preset wipes any saved custom body + untilAt so
    // the user gets the clean preset they asked for.
    onSelect({ preset });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.scrim, { backgroundColor: t.color.scrim }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close repeat menu"
      />
      <View style={styles.center} pointerEvents="box-none">
        <View
          style={[
            styles.card,
            {
              backgroundColor: t.color.surfaceRaised,
              borderColor: t.color.border,
              borderRadius: t.radius['2xl'],
              paddingVertical: t.spacing.sm,
            },
          ]}
        >
          {options.map((opt) => {
            const selected = opt.preset === current.preset;
            return (
              <Pressable
                key={opt.preset}
                onPress={() => choose(opt.preset)}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: t.color.surfaceMuted },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: selected ? t.color.accent : t.color.textPrimary,
                    fontSize: t.fontSize.md,
                    fontWeight: selected ? t.fontWeight.semibold : t.fontWeight.regular,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}

          {/* Divider + Custom row. Tapping it closes the popover and asks
              the parent to mount the editor sheet. */}
          <View
            style={[
              styles.divider,
              { backgroundColor: t.color.borderMuted, marginVertical: 4 },
            ]}
          />
          <Pressable
            onPress={() => choose('custom')}
            hitSlop={4}
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: t.color.surfaceMuted },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: customSelected }}
          >
            <Text
              style={{
                flex: 1,
                color: customSelected ? t.color.accent : t.color.textPrimary,
                fontSize: t.fontSize.md,
                fontWeight: customSelected ? t.fontWeight.semibold : t.fontWeight.regular,
              }}
            >
              {customLabel}
            </Text>
            <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.lg }}>›</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject },
  center: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 24,
    paddingLeft: 24,
  },
  card: {
    minWidth: 240,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
});
