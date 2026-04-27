import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatDayOfMonthOrdinal,
  MONTH_SHORT,
  WEEKDAY_LONG,
} from '../lib/date';
import { isPremiumFeatureEnabled, shouldShowPremiumBadge } from '../lib/premium';
import { useTheme } from '../theme';
import type { RepeatDraft, RepeatPreset } from './scheduleTypes';

type RepeatPopoverProps = {
  visible: boolean;
  /** Date the repeat would anchor to (used to label "every month on the Nth" etc). */
  anchorDate: number | null;
  current: RepeatDraft;
  onClose: () => void;
  onSelect: (next: RepeatDraft) => void;
};

type PresetOption = {
  preset: RepeatPreset;
  label: string;
  /** When set, the option is disabled (premium gate). */
  premiumKey?: 'repeat_custom';
};

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
    { preset: 'custom',  label: 'Custom', premiumKey: 'repeat_custom' },
  ];
}

export function RepeatPopover({
  visible,
  anchorDate,
  current,
  onClose,
  onSelect,
}: RepeatPopoverProps) {
  const t = useTheme();
  const options = buildOptions(anchorDate);

  const choose = (preset: RepeatPreset) => {
    if (preset === 'custom') {
      // Custom rules need an editor we haven't built yet — Phase 7 (recurrence
      // engine) is when we'll add the inline editor and full rrule semantics.
      // For now, accept the preset with a sane default rule and let the user
      // refine it later via task editing (Phase 8).
      const next: RepeatDraft = {
        preset: 'custom',
        custom: { freq: 'weekly', intervalN: 1 },
      };
      onSelect(next);
      onClose();
      return;
    }
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
            const showCrown = opt.premiumKey ? shouldShowPremiumBadge(opt.premiumKey) : false;
            const enabled = opt.premiumKey ? isPremiumFeatureEnabled(opt.premiumKey) : true;
            return (
              <Pressable
                key={opt.preset}
                onPress={() => enabled && choose(opt.preset)}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: t.color.surfaceMuted },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !enabled }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: selected ? t.color.accent : t.color.textPrimary,
                    fontSize: t.fontSize.md,
                    fontWeight: selected ? t.fontWeight.semibold : t.fontWeight.regular,
                    opacity: enabled ? 1 : 0.4,
                  }}
                >
                  {opt.label}
                </Text>
                {showCrown ? (
                  <Text style={{ color: t.color.warn, fontSize: t.fontSize.sm, marginLeft: 6 }}>👑</Text>
                ) : null}
              </Pressable>
            );
          })}
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
});
