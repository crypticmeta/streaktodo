import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
  type LayoutChangeEvent,
  type TextInput as RNTextInput,
} from 'react-native';
import { categoriesRepo, useCategories } from '../db';
import * as analytics from '../lib/analytics';
import { MONTH_SHORT } from '../lib/date';
import { useTheme } from '../theme';
import { CategoryPickerMenu } from './CategoryPickerMenu';
import { CreateCategoryDialog } from './CreateCategoryDialog';
import { Icon } from './Icon';
import { SchedulePickerSheet } from './SchedulePickerSheet';
import { EMPTY_SCHEDULE, type ScheduleDraft } from './scheduleTypes';

export type ComposerSubmitInput = {
  title: string;
  subtasks: string[];
  categoryId: string | null;
  schedule: ScheduleDraft;
};

// Prefilled state used when opening the composer in edit mode. The caller
// builds this from a TaskGraph (see tasksRepo.getTaskGraph) and the schedule
// draft helpers in app/(tabs)/index.tsx.
export type ComposerInitial = {
  title: string;
  subtasks: string[];
  categoryId: string | null;
  schedule: ScheduleDraft;
};

type TaskComposerProps = {
  visible: boolean;
  onClose: () => void;
  /** Defined → edit mode; undefined → create mode. */
  initial?: ComposerInitial;
  onSubmit?: (input: ComposerSubmitInput) => Promise<void> | void;
  /** Only meaningful in edit mode. When set, a delete affordance renders. */
  onDelete?: () => void;
};

const TITLE_MAX_LENGTH = 140;
const SUBTASK_MAX_LENGTH = 120;

type SubtaskDraft = {
  // Stable client-side id used as React key while drafting. Real DB id is
  // assigned by subtasksRepo on save.
  draftId: string;
  title: string;
};

let nextDraftId = 0;
const newDraftId = () => `draft-${++nextDraftId}`;

// React Native's KeyboardAvoidingView is unreliable inside a Modal — the modal
// renders in a separate native window that doesn't share keyboard metrics with
// the parent tree. Subscribing to Keyboard events directly works on both
// platforms and inside Modals. We expose an Animated.Value so consumers can
// compose it into a native-driven transform without re-rendering the whole
// sheet on every keyboard frame.
function useKeyboardOffset(): Animated.Value {
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => offset.setValue(e.endCoordinates.height);
    const onHide = () => offset.setValue(0);

    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [offset]);

  return offset;
}

export function TaskComposer({ visible, onClose, initial, onSubmit, onDelete }: TaskComposerProps) {
  const t = useTheme();
  const [title, setTitle] = useState('');
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleDraft>(EMPTY_SCHEDULE);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chipAnchor, setChipAnchor] = useState<{ left: number; bottom: number } | null>(null);
  const inputRef = useRef<RNTextInput>(null);
  const subtaskRefs = useRef<Map<string, RNTextInput | null>>(new Map());
  const keyboardOffset = useKeyboardOffset();
  const { categories, refresh: refreshCategories } = useCategories();

  // Open progress: 0 = closed, 1 = open. Drives the scrim opacity and the
  // sheet's translateY in parallel. We keep the Modal mounted while the close
  // animation runs out, then unmount; this prevents the sheet from snapping
  // to instant-hidden and avoids the platform's default "slide" behaviour
  // (which slides the scrim too, which looks wrong).
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  // Captured on first sheet layout. Used to translate the sheet from below
  // the screen on open. A generous default keeps the first open animated
  // before measurement lands.
  const sheetHeightRef = useRef<number>(Dimensions.get('window').height * 0.9);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // `mounted` deliberately omitted: we only want to react to `visible` flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleSheetLayout = (e: LayoutChangeEvent) => {
    sheetHeightRef.current = e.nativeEvent.layout.height;
  };

  const sheetOpenTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [sheetHeightRef.current, 0],
  });
  // Compose open-animation lift with keyboard avoidance into a single
  // native-driven value, so the transform array stays stable across renders.
  const sheetTranslateY = Animated.subtract(sheetOpenTranslateY, keyboardOffset);
  const scrimOpacity = progress;

  const selectedCategory = useMemo(
    () => (categoryId ? categories.find((c) => c.id === categoryId) ?? null : null),
    [categories, categoryId]
  );

  // Reset content + focus the input every time the sheet opens. In edit mode
  // we prefill from `initial`; in create mode we start from blanks.
  useEffect(() => {
    if (!visible) return;
    setTitle(initial?.title ?? '');
    setSubtasks(
      initial?.subtasks.map((title) => ({ draftId: newDraftId(), title })) ?? []
    );
    setCategoryId(initial?.categoryId ?? null);
    setPickerOpen(false);
    setCreateCategoryOpen(false);
    setSchedule(initial?.schedule ?? EMPTY_SCHEDULE);
    setScheduleOpen(false);
    setSubmitting(false);
    setError(null);
    subtaskRefs.current.clear();
    // Native autofocus is unreliable inside a Modal that just animated in.
    // A short delay after `visible` flips lets the modal mount before we ask
    // for focus.
    const id = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(id);
    // We deliberately depend on `visible` only — re-running when `initial`
    // changes would clobber in-progress edits if the parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const trimmed = title.trim();
  const cleanedSubtasks = subtasks.map((s) => s.title.trim()).filter((s) => s.length > 0);
  const canSave = trimmed.length > 0 && !submitting;
  const remaining = TITLE_MAX_LENGTH - title.length;
  const showLengthHint = remaining <= 20;

  const handleTitleChange = (next: string) => {
    setTitle(next);
    if (error) setError(null);
  };

  const handleAddSubtask = () => {
    const draft: SubtaskDraft = { draftId: newDraftId(), title: '' };
    setSubtasks((prev) => [...prev, draft]);
    requestAnimationFrame(() => {
      subtaskRefs.current.get(draft.draftId)?.focus();
    });
  };

  const handleSubtaskChange = (draftId: string, next: string) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.draftId === draftId ? { ...s, title: next } : s))
    );
    if (error) setError(null);
  };

  const handleRemoveSubtask = (draftId: string) => {
    setSubtasks((prev) => prev.filter((s) => s.draftId !== draftId));
    subtaskRefs.current.delete(draftId);
  };

  const handleSubtaskSubmit = (draftId: string) => {
    const row = subtasks.find((s) => s.draftId === draftId);
    if (!row) return;
    if (row.title.trim().length === 0) {
      handleRemoveSubtask(draftId);
      return;
    }
    handleAddSubtask();
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit?.({ title: trimmed, subtasks: cleanedSubtasks, categoryId, schedule });
      handleClose();
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : 'Could not save the task. Try again.');
    }
  };

  // Chip-anchored category menu. We measure where the category chip sits in
  // the screen, then ask the menu to position itself just above it.
  const handleChipLayout = (e: LayoutChangeEvent) => {
    // We need screen-relative coords; the chip is inside a positioned sheet
    // that's translated for the keyboard. Use measureInWindow at tap time
    // instead via a ref. For now, capture the local layout — the menu
    // anchor refines this on actual press.
    void e; // unused; kept to keep onLayout wired for future precise anchoring
  };

  const chipRef = useRef<View>(null);

  const handleOpenPicker = () => {
    Keyboard.dismiss();
    chipRef.current?.measureInWindow((x, y, _w, h) => {
      const screen = Dimensions.get('window');
      // Place the menu's bottom just above the chip, left-aligned with it.
      setChipAnchor({ left: x, bottom: screen.height - y + 6 });
      setScheduleOpen(false);
      setPickerOpen(true);
    });
  };

  const handleOpenSchedule = () => {
    Keyboard.dismiss();
    setScheduleOpen(true);
  };

  const handleCreateCategory = async ({ name, color }: { name: string; color: string }) => {
    const created = await categoriesRepo.createCategory({ name, color });
    void analytics.track('category_created');
    await refreshCategories();
    setCategoryId(created.id);
    setCreateCategoryOpen(false);
  };

  return (
    <Modal
      visible={mounted}
      animationType="none"
      transparent
      onRequestClose={handleClose}
      // Android-only: lets the modal share keyboard metrics with its host
      // window, which is required for our Keyboard listener to receive events
      // reliably across OEMs.
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View
          style={[styles.scrim, { backgroundColor: t.color.scrim, opacity: scrimOpacity }]}
          // Tap-through is suppressed via the Pressable below.
          pointerEvents="none"
        />
        <Pressable
          style={styles.scrim}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close composer"
        />
        <Animated.View
          onLayout={handleSheetLayout}
          style={[
            styles.sheet,
            {
              backgroundColor: t.color.surface,
              borderTopLeftRadius: t.radius['3xl'],
              borderTopRightRadius: t.radius['3xl'],
              borderColor: t.color.border,
              paddingHorizontal: t.spacing['2xl'],
              paddingTop: t.spacing.lg,
              paddingBottom: t.spacing['2xl'],
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: t.color.borderStrong, borderRadius: t.radius.pill }]} />

          {/* Title input — large; matches the inspiration's "Input new task here" */}
          <View
            style={{
              backgroundColor: t.color.surfaceMuted,
              borderRadius: t.radius.lg,
              paddingHorizontal: t.spacing.lg,
              paddingVertical: t.spacing.md,
              marginTop: t.spacing.sm,
            }}
          >
            <TextInput
              ref={inputRef}
              value={title}
              onChangeText={handleTitleChange}
              placeholder="Input new task here"
              placeholderTextColor={t.color.textMuted}
              maxLength={TITLE_MAX_LENGTH}
              multiline
              scrollEnabled={false}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              blurOnSubmit
              style={{
                color: t.color.textPrimary,
                fontSize: t.fontSize.lg,
                lineHeight: t.fontSize.lg * t.lineHeight.snug,
                fontWeight: t.fontWeight.medium,
                minHeight: 44,
                padding: 0,
              }}
            />
          </View>

          {error || showLengthHint ? (
            <View style={styles.metaRow}>
              <Text
                style={{
                  color: error ? t.color.danger : t.color.textMuted,
                  fontSize: t.fontSize.xs,
                  flex: 1,
                }}
              >
                {error ?? ' '}
              </Text>
              {showLengthHint ? (
                <Text
                  style={{
                    color: remaining <= 0 ? t.color.danger : t.color.textMuted,
                    fontSize: t.fontSize.xs,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {remaining} left
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* Subtask rows. Each row matches the inspiration's "○ Input the sub-task ×" */}
          {subtasks.length > 0 ? (
            <View style={{ gap: t.spacing.sm, marginTop: t.spacing.md }}>
              {subtasks.map((s) => (
                <View key={s.draftId} style={styles.subtaskRow}>
                  <View style={[styles.subtaskBullet, { borderColor: t.color.borderStrong }]} />
                  <TextInput
                    ref={(ref) => {
                      if (ref) subtaskRefs.current.set(s.draftId, ref);
                      else subtaskRefs.current.delete(s.draftId);
                    }}
                    value={s.title}
                    onChangeText={(next) => handleSubtaskChange(s.draftId, next)}
                    placeholder="Input the sub-task"
                    placeholderTextColor={t.color.textMuted}
                    maxLength={SUBTASK_MAX_LENGTH}
                    returnKeyType="next"
                    onSubmitEditing={() => handleSubtaskSubmit(s.draftId)}
                    blurOnSubmit={false}
                    style={[
                      styles.subtaskInput,
                      { color: t.color.textPrimary, fontSize: t.fontSize.md },
                    ]}
                  />
                  <Pressable
                    onPress={() => handleRemoveSubtask(s.draftId)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Remove subtask"
                  >
                    <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.lg }}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {/* Action row: [chip] [📅] [🔗 subtasks] [📋 templates 👑] · spacer · [● send] */}
          <View style={[styles.actionRow, { marginTop: t.spacing.lg }]}>
            <View
              ref={chipRef}
              onLayout={handleChipLayout}
              collapsable={false}
              style={styles.chipWrap}
            >
              <Pressable
                onPress={handleOpenPicker}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={
                  selectedCategory ? `Category: ${selectedCategory.name}` : 'Pick category'
                }
                accessibilityHint="Opens the category menu"
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: selectedCategory
                      ? t.color.accentSoft
                      : pressed
                        ? t.color.accentMuted
                        : t.color.surfaceMuted,
                    paddingHorizontal: t.spacing.md,
                    paddingVertical: t.spacing.sm,
                    borderRadius: t.radius.pill,
                  },
                ]}
              >
                {selectedCategory ? (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: selectedCategory.color ?? t.color.accent,
                    }}
                  />
                ) : null}
                <Text
                  style={{
                    color: t.color.textPrimary,
                    fontSize: t.fontSize.sm,
                    fontWeight: t.fontWeight.semibold,
                  }}
                >
                  {selectedCategory ? selectedCategory.name : 'No Category'}
                </Text>
              </Pressable>
            </View>

            {/* Calendar trigger */}
            <Pressable
              onPress={handleOpenSchedule}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Set schedule"
              style={({ pressed }) => [
                styles.iconButton,
                {
                  backgroundColor:
                    schedule.dueAt !== null
                      ? t.color.accentSoft
                      : pressed
                        ? t.color.surfaceMuted
                        : 'transparent',
                  borderRadius: t.radius.md,
                },
              ]}
            >
              {schedule.dueAt !== null ? (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: t.color.accent, fontSize: 9, fontWeight: t.fontWeight.bold, lineHeight: 11 }}>
                    {MONTH_SHORT[new Date(schedule.dueAt).getMonth()].toUpperCase()}
                  </Text>
                  <Text style={{ color: t.color.textPrimary, fontSize: 13, fontWeight: t.fontWeight.bold, lineHeight: 15 }}>
                    {new Date(schedule.dueAt).getDate()}
                  </Text>
                </View>
              ) : (
                <Icon name="calendar" size={20} color={t.color.textSecondary} />
              )}
            </Pressable>

            {/* Subtasks toggle — adds a fresh subtask row inline */}
            <Pressable
              onPress={handleAddSubtask}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Add subtask"
              style={({ pressed }) => [
                styles.iconButton,
                {
                  backgroundColor: pressed ? t.color.surfaceMuted : 'transparent',
                  borderRadius: t.radius.md,
                },
              ]}
            >
              <Icon name="subtask" size={20} color={t.color.textSecondary} />
            </Pressable>

            <View style={{ flex: 1 }} />

            {/* Delete (edit mode only). Lives next to the send button so the
                most destructive action sits beside the most constructive one
                — clearer than burying it in a menu, easier than duplicating
                a separate detail screen for V0. */}
            {onDelete ? (
              <Pressable
                onPress={onDelete}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Delete task"
                style={({ pressed }) => [
                  styles.iconButton,
                  {
                    backgroundColor: pressed ? t.color.dangerSoft : 'transparent',
                    borderRadius: t.radius.md,
                    marginRight: t.spacing.xs,
                  },
                ]}
              >
                <Icon name="trash" size={20} color={t.color.danger} />
              </Pressable>
            ) : null}

            {/* Circular send button — replaces the text Save. Always rendered
                with the accent fill so it stays visible behind a scrim; uses
                opacity + a softer arrow color to communicate disabled state. */}
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Save task"
              accessibilityState={{ disabled: !canSave }}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: t.color.accent,
                  opacity: !canSave ? 0.4 : pressed ? 0.85 : 1,
                  transform: [{ scale: pressed && canSave ? 0.95 : 1 }],
                  ...t.elevation.md,
                  shadowColor: t.color.accent,
                },
              ]}
            >
              <Icon name="send" size={22} color={t.color.textOnAccent} />
            </Pressable>
          </View>
        </Animated.View>
      </View>

      <CategoryPickerMenu
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        categories={categories}
        selectedId={categoryId}
        onSelect={setCategoryId}
        anchor={chipAnchor ?? { left: 24, bottom: 100 }}
        onCreateNew={() => setCreateCategoryOpen(true)}
      />

      <CreateCategoryDialog
        visible={createCategoryOpen}
        onCancel={() => setCreateCategoryOpen(false)}
        onCreate={handleCreateCategory}
      />

      <SchedulePickerSheet
        visible={scheduleOpen}
        initial={schedule}
        onCancel={() => setScheduleOpen(false)}
        onConfirm={(next) => {
          setSchedule(next);
          setScheduleOpen(false);
        }}
      />
    </Modal>
  );
}

const SEND_SIZE = 48;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopWidth: 1,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 16,
    marginTop: 6,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subtaskBullet: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  subtaskInput: {
    flex: 1,
    paddingVertical: 6,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipWrap: {
    // Wrapper exists so we can measureInWindow on the chip without disturbing
    // its own pressed/hover state.
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: SEND_SIZE,
    height: SEND_SIZE,
    borderRadius: SEND_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
