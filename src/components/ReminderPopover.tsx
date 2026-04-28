import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { ReminderType } from '../db';
import * as scheduler from '../lib/notificationScheduler';
import { useTheme } from '../theme';
import {
  REMINDER_LEAD_OPTIONS,
  type ReminderDraft,
} from './scheduleTypes';

type ReminderPopoverProps = {
  visible: boolean;
  initial: ReminderDraft;
  onCancel: () => void;
  onConfirm: (next: ReminderDraft) => void;
};

const REMINDER_TYPE_OPTIONS: ReadonlyArray<{
  value: ReminderType;
  label: string;
}> = [
  { value: 'notification', label: 'Notification' },
];

// Small in-place dropdown — renders the current value with a chevron, and on
// tap toggles a list of options below it. Used for "Reminder at" and "Reminder
// Type" rows. Keeps everything inside the parent modal — no nested modals.
function InlineSelect<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (next: T) => void;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <View style={styles.selectRow}>
      <View style={styles.selectLabelWrap}>
        <Text style={{ color: t.color.textPrimary, fontSize: t.fontSize.md, fontWeight: t.fontWeight.semibold }}>
          {label}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', flex: 1 }}>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${current?.label ?? 'choose'}`}
          style={styles.selectValue}
        >
          <Text style={{ color: t.color.textSecondary, fontSize: t.fontSize.md }}>
            {current?.label ?? 'Choose'}
          </Text>
          <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.md, marginLeft: 4 }}>▾</Text>
        </Pressable>

        {open ? (
          <View
            style={[
              styles.selectMenu,
              { backgroundColor: t.color.surfaceRaised, borderColor: t.color.border, borderRadius: t.radius.lg },
            ]}
          >
            {options.map((opt) => {
              return (
                <Pressable
                  key={String(opt.value)}
                  onPress={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.selectMenuItem,
                    pressed && { backgroundColor: t.color.surfaceMuted },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: opt.value === value }}
                >
                  <Text
                    style={{
                      color: opt.value === value ? t.color.accent : t.color.textPrimary,
                      fontWeight: opt.value === value ? t.fontWeight.semibold : t.fontWeight.regular,
                      fontSize: t.fontSize.md,
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function ReminderPopover({ visible, initial, onCancel, onConfirm }: ReminderPopoverProps) {
  const t = useTheme();
  const [draft, setDraft] = useState<ReminderDraft>(initial);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // When the user flips the reminder ON, ask for permission. We don't block
  // saving the draft if denied — the row still persists, the scheduler just
  // won't arm anything until the user grants permission later.
  const handleToggle = async (enabled: boolean) => {
    setDraft((d) => ({ ...d, enabled }));
    if (!enabled) return;
    const result = await scheduler.ensurePermission();
    setPermissionDenied(result === 'denied');
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
      statusBarTranslucent
      // Reset the local draft to the latest `initial` every time the popover
      // opens, so re-opening starts from the parent's current value.
      onShow={() => setDraft(initial)}
    >
      <Pressable
        style={[styles.scrim, { backgroundColor: t.color.scrim }]}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Close reminder settings"
      />
      <View style={styles.center} pointerEvents="box-none">
        <View
          style={[
            styles.card,
            {
              backgroundColor: t.color.surfaceRaised,
              borderColor: t.color.border,
              borderRadius: t.radius['2xl'],
              padding: t.spacing['2xl'],
            },
          ]}
        >
          <View style={styles.headerRow}>
            <Text
              style={{
                color: t.color.textPrimary,
                fontSize: t.fontSize.lg,
                fontWeight: t.fontWeight.bold,
                flex: 1,
              }}
            >
              {draft.enabled ? 'Reminder is on' : 'Reminder is off'}
            </Text>
            <Switch
              value={draft.enabled}
              onValueChange={handleToggle}
              trackColor={{ true: t.color.accent, false: t.color.border }}
              thumbColor={t.color.surface}
            />
          </View>

          {permissionDenied && draft.enabled ? (
            <View
              style={{
                marginTop: t.spacing.md,
                padding: t.spacing.md,
                borderRadius: t.radius.md,
                backgroundColor: t.color.warnSoft,
              }}
            >
              <Text style={{ color: t.color.textPrimary, fontSize: t.fontSize.sm, fontWeight: t.fontWeight.semibold }}>
                Notifications are off
              </Text>
              <Text style={{ color: t.color.textSecondary, fontSize: t.fontSize.xs, marginTop: 4, lineHeight: 18 }}>
                Your task will save, but no reminder will fire until you allow notifications in system settings.
              </Text>
            </View>
          ) : null}

          {draft.enabled ? (
            <View style={{ gap: t.spacing.md, marginTop: t.spacing.lg }}>
              <InlineSelect
                label="Reminder at"
                value={draft.leadMinutes}
                options={REMINDER_LEAD_OPTIONS.map((o) => ({ value: o.minutes, label: o.label }))}
                onChange={(leadMinutes) => setDraft((d) => ({ ...d, leadMinutes }))}
              />

              <InlineSelect
                label="Reminder Type"
                value={draft.type}
                options={REMINDER_TYPE_OPTIONS}
                onChange={(type) => setDraft((d) => ({ ...d, type }))}
              />
            </View>
          ) : null}

          <View style={[styles.footer, { marginTop: t.spacing['2xl'] }]}>
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
    maxWidth: 480,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  selectLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectMenu: {
    marginTop: 6,
    borderWidth: 1,
    paddingVertical: 4,
    minWidth: 200,
  },
  selectMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
