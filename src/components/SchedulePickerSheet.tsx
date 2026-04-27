import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  addDays,
  formatTimeFromMinutes,
  nextWeekday,
  startOfDay,
  startOfMonth,
  Weekday,
} from '../lib/date';
import { useTheme } from '../theme';
import { CalendarGrid } from './CalendarGrid';
import { Icon, type IconName } from './Icon';
import { ReminderPopover } from './ReminderPopover';
import { RepeatPopover } from './RepeatPopover';
import {
  canConfigureReminder,
  type ScheduleDraft,
} from './scheduleTypes';

type SchedulePickerSheetProps = {
  visible: boolean;
  initial: ScheduleDraft;
  onCancel: () => void;
  onConfirm: (draft: ScheduleDraft) => void;
};

type Shortcut = {
  key: string;
  label: string;
  resolve: () => number | null;
};

function buildShortcuts(): Shortcut[] {
  const today = startOfDay();
  return [
    { key: 'today',    label: 'Today',         resolve: () => today },
    { key: 'tomorrow', label: 'Tomorrow',      resolve: () => addDays(today, 1) },
    { key: '3-days',   label: '3 Days Later',  resolve: () => addDays(today, 3) },
    { key: 'sunday',   label: 'This Sunday',   resolve: () => nextWeekday(Weekday.Sun, today) },
    { key: 'no-date',  label: 'No Date',       resolve: () => null },
  ];
}

// Compose a label for the repeat row from a draft.
function repeatLabel(draft: ScheduleDraft): string {
  const r = draft.repeat;
  switch (r.preset) {
    case 'none':    return 'No';
    case 'daily':   return 'Daily Repeat';
    case 'weekly':  return 'Weekly Repeat';
    case 'monthly': return 'Monthly Repeat';
    case 'yearly':  return 'Yearly Repeat';
    case 'custom':  return 'Custom';
  }
}

function reminderLabel(draft: ScheduleDraft): string {
  if (!draft.reminder.enabled) return 'No';
  // Inspiration shows the actual fire-time (e.g., "06:55 am") — that requires
  // a dueTime to compute. Fall back to a minutes-before label otherwise.
  if (draft.dueTime !== null) {
    const fire = draft.dueTime - draft.reminder.leadMinutes;
    if (fire >= 0) return formatTimeFromMinutes(fire);
  }
  if (draft.reminder.leadMinutes === 0) return 'At time';
  return `${draft.reminder.leadMinutes} min before`;
}

export function SchedulePickerSheet({
  visible,
  initial,
  onCancel,
  onConfirm,
}: SchedulePickerSheetProps) {
  const t = useTheme();
  const [draft, setDraft] = useState<ScheduleDraft>(initial);
  const [month, setMonth] = useState<number>(() =>
    startOfMonth(initial.dueAt ?? Date.now())
  );
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);

  // Reset on every open so opening with a different `initial` is honoured.
  useEffect(() => {
    if (!visible) return;
    setDraft(initial);
    setMonth(startOfMonth(initial.dueAt ?? Date.now()));
    setShowTimePicker(false);
    setReminderOpen(false);
    setRepeatOpen(false);
  }, [visible, initial]);

  const shortcuts = useMemo(() => (visible ? buildShortcuts() : []), [visible]);

  const handlePickShortcut = (s: Shortcut) => {
    const next = s.resolve();
    setDraft((d) => ({ ...d, dueAt: next, ...(next === null ? { dueTime: null } : null) }));
    if (next !== null) setMonth(startOfMonth(next));
  };

  const handlePickDay = (dayStartTs: number) => {
    setDraft((d) => ({ ...d, dueAt: dayStartTs }));
  };

  const handleClearTime = () => {
    setDraft((d) => ({ ...d, dueTime: null }));
  };

  const handleTimeChange = (_e: unknown, picked?: Date) => {
    // Android's picker fires once and dismisses itself; iOS uses a spinner that
    // stays visible. Either way we hide our flag and update the draft if a
    // value was given.
    setShowTimePicker(false);
    if (!picked) return;
    const minutes = picked.getHours() * 60 + picked.getMinutes();
    setDraft((d) => ({ ...d, dueTime: minutes }));
  };

  const reminderConfigurable = canConfigureReminder(draft);

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
        accessibilityLabel="Close schedule picker"
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
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Calendar */}
            <CalendarGrid
              month={month}
              onMonthChange={setMonth}
              selected={draft.dueAt}
              onSelect={handlePickDay}
            />

            {/* Quick shortcuts */}
            <View style={[styles.shortcutGrid, { marginTop: t.spacing.md }]}>
              {shortcuts.map((s) => {
                const value = s.resolve();
                const selected =
                  value === null
                    ? draft.dueAt === null
                    : draft.dueAt !== null && value === draft.dueAt;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => handlePickShortcut(s)}
                    style={({ pressed }) => [
                      styles.shortcut,
                      {
                        backgroundColor: selected
                          ? t.color.accent
                          : pressed
                            ? t.color.surfaceMuted
                            : t.color.surface,
                        borderColor: selected ? t.color.accent : t.color.border,
                        borderRadius: t.radius.lg,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={{
                        color: selected ? t.color.textOnAccent : t.color.textPrimary,
                        fontSize: t.fontSize.sm,
                        fontWeight: t.fontWeight.semibold,
                      }}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Time row */}
            <ScheduleRow
              icon="time"
              label="Time"
              valueLabel={draft.dueTime !== null ? formatTimeFromMinutes(draft.dueTime) : 'No'}
              valueDimmed={draft.dueTime === null}
              onPress={() => setShowTimePicker(true)}
              onClear={draft.dueTime !== null ? handleClearTime : undefined}
              disabled={draft.dueAt === null}
              disabledHint={draft.dueAt === null ? 'Pick a date first' : undefined}
            />

            {/* Reminder row */}
            <ScheduleRow
              icon="reminder"
              label="Reminder"
              valueLabel={reminderLabel(draft)}
              valueDimmed={!draft.reminder.enabled}
              onPress={() => setReminderOpen(true)}
              disabled={!reminderConfigurable}
              disabledHint={!reminderConfigurable ? 'Pick a date first' : undefined}
            />

            {/* Repeat row */}
            <ScheduleRow
              icon="repeat"
              label="Repeat"
              valueLabel={repeatLabel(draft)}
              valueDimmed={draft.repeat.preset === 'none'}
              onPress={() => setRepeatOpen(true)}
              disabled={draft.dueAt === null}
              disabledHint={draft.dueAt === null ? 'Pick a date first' : undefined}
            />
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: t.color.borderMuted }]}>
            <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.md, fontWeight: t.fontWeight.semibold }}>
                CANCEL
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(draft)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Done"
              style={{ marginLeft: 24 }}
            >
              <Text style={{ color: t.color.accent, fontSize: t.fontSize.md, fontWeight: t.fontWeight.bold }}>
                DONE
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Native time picker. Android shows it as a one-shot dialog; iOS as a
          spinner that stays visible until we toggle showTimePicker off. */}
      {showTimePicker ? (
        <DateTimePicker
          value={(() => {
            const d = new Date();
            if (draft.dueTime !== null) {
              d.setHours(Math.floor(draft.dueTime / 60), draft.dueTime % 60, 0, 0);
            } else {
              d.setMinutes(0, 0, 0);
            }
            return d;
          })()}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
        />
      ) : null}

      <ReminderPopover
        visible={reminderOpen}
        initial={draft.reminder}
        onCancel={() => setReminderOpen(false)}
        onConfirm={(reminder) => {
          setDraft((d) => ({ ...d, reminder }));
          setReminderOpen(false);
        }}
      />

      <RepeatPopover
        visible={repeatOpen}
        anchorDate={draft.dueAt}
        current={draft.repeat}
        onClose={() => setRepeatOpen(false)}
        onSelect={(repeat) => setDraft((d) => ({ ...d, repeat }))}
      />
    </Modal>
  );
}

function ScheduleRow({
  icon,
  label,
  valueLabel,
  valueDimmed,
  onPress,
  onClear,
  disabled,
  disabledHint,
}: {
  icon: IconName;
  label: string;
  valueLabel: string;
  valueDimmed: boolean;
  onPress: () => void;
  onClear?: () => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => !disabled && onPress()}
      style={({ pressed }) => [
        styles.row,
        {
          borderTopColor: t.color.borderMuted,
          opacity: disabled ? 0.5 : 1,
          backgroundColor: pressed && !disabled ? t.color.surfaceMuted : 'transparent',
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${valueLabel}`}
      accessibilityState={{ disabled: Boolean(disabled) }}
      accessibilityHint={disabledHint}
    >
      <View style={styles.rowIconBubble}>
        <Icon name={icon} size={20} color={t.color.textSecondary} />
      </View>
      <Text
        style={{
          color: t.color.textPrimary,
          fontSize: t.fontSize.lg,
          fontWeight: t.fontWeight.semibold,
          flex: 1,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: valueDimmed ? t.color.textMuted : t.color.textSecondary,
          fontSize: t.fontSize.md,
        }}
      >
        {valueLabel}
      </Text>
      {onClear ? (
        <Pressable onPress={onClear} hitSlop={8} style={{ marginLeft: 8 }}>
          <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.lg }}>×</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxHeight: '90%',
    borderWidth: 1,
  },
  shortcutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shortcut: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingVertical: 14,
    gap: 12,
  },
  rowIconBubble: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: 12,
    borderTopWidth: 1,
    marginTop: 8,
  },
});
