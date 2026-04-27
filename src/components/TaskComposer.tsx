import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
  type TextInput as RNTextInput,
} from 'react-native';
import { useTheme } from '../theme';

export type ComposerSubmitInput = {
  title: string;
  subtasks: string[];
};

type TaskComposerProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit?: (input: ComposerSubmitInput) => Promise<void> | void;
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
// platforms and inside Modals.
function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => setOffset(e.endCoordinates.height);
    const onHide = () => setOffset(0);

    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return offset;
}

export function TaskComposer({ visible, onClose, onSubmit }: TaskComposerProps) {
  const t = useTheme();
  const [title, setTitle] = useState('');
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<RNTextInput>(null);
  const subtaskRefs = useRef<Map<string, RNTextInput | null>>(new Map());
  const keyboardOffset = useKeyboardOffset();

  // Reset content + focus the input every time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setSubtasks([]);
    setSubmitting(false);
    setError(null);
    subtaskRefs.current.clear();
    // Native autofocus is unreliable inside a Modal that just animated in.
    // A short delay after `visible` flips lets the modal mount before we ask
    // for focus.
    const id = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(id);
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
    // Focus the new row after it mounts.
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
    // If the row has content, append a new empty row right after; otherwise
    // remove the empty row so we don't accumulate blanks.
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
      await onSubmit?.({ title: trimmed, subtasks: cleanedSubtasks });
      handleClose();
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : 'Could not save the task. Try again.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      // Android-only: lets the modal share keyboard metrics with its host
      // window, which is required for our Keyboard listener to receive events
      // reliably across OEMs.
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={[styles.scrim, { backgroundColor: t.color.scrim }]}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close composer"
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: t.color.surface,
              borderTopLeftRadius: t.radius['3xl'],
              borderTopRightRadius: t.radius['3xl'],
              borderColor: t.color.border,
              paddingHorizontal: t.spacing['2xl'],
              paddingTop: t.spacing.lg,
              paddingBottom: t.spacing['4xl'],
              transform: [{ translateY: -keyboardOffset }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: t.color.borderStrong, borderRadius: t.radius.pill }]} />

          <View style={styles.headerRow}>
            <Pressable
              onPress={handleClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.md, fontWeight: t.fontWeight.medium }}>
                Cancel
              </Text>
            </Pressable>

            <Text
              style={{
                color: t.color.textPrimary,
                fontSize: t.fontSize.lg,
                fontWeight: t.fontWeight.semibold,
              }}
            >
              New task
            </Text>

            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Save task"
              accessibilityState={{ disabled: !canSave }}
            >
              <Text
                style={{
                  color: canSave ? t.color.accent : t.color.textMuted,
                  fontSize: t.fontSize.md,
                  fontWeight: t.fontWeight.bold,
                  opacity: canSave ? 1 : 0.55,
                }}
              >
                {submitting ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <TextInput
            ref={inputRef}
            value={title}
            onChangeText={handleTitleChange}
            placeholder="What needs doing?"
            placeholderTextColor={t.color.textMuted}
            maxLength={TITLE_MAX_LENGTH}
            multiline
            scrollEnabled={false}
            returnKeyType="done"
            onSubmitEditing={handleSave}
            blurOnSubmit
            style={[
              styles.input,
              {
                color: t.color.textPrimary,
                fontSize: t.fontSize['2xl'],
                lineHeight: t.fontSize['2xl'] * t.lineHeight.snug,
                marginTop: t.spacing.lg,
                paddingVertical: t.spacing.sm,
              },
            ]}
          />

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

          {/* Subtasks block */}
          <View
            style={{
              borderTopColor: t.color.borderMuted,
              borderTopWidth: 1,
              marginTop: t.spacing.lg,
              paddingTop: t.spacing.lg,
              gap: t.spacing.sm,
            }}
          >
            {subtasks.map((s) => (
              <View key={s.draftId} style={styles.subtaskRow}>
                <View
                  style={[
                    styles.subtaskBullet,
                    { borderColor: t.color.borderStrong },
                  ]}
                />
                <TextInput
                  ref={(ref) => {
                    if (ref) subtaskRefs.current.set(s.draftId, ref);
                    else subtaskRefs.current.delete(s.draftId);
                  }}
                  value={s.title}
                  onChangeText={(next) => handleSubtaskChange(s.draftId, next)}
                  placeholder="Subtask"
                  placeholderTextColor={t.color.textMuted}
                  maxLength={SUBTASK_MAX_LENGTH}
                  returnKeyType="next"
                  onSubmitEditing={() => handleSubtaskSubmit(s.draftId)}
                  blurOnSubmit={false}
                  style={[
                    styles.subtaskInput,
                    {
                      color: t.color.textPrimary,
                      fontSize: t.fontSize.md,
                    },
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

            <Pressable
              onPress={handleAddSubtask}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Add subtask"
              style={styles.addSubtaskRow}
            >
              <Text style={{ color: t.color.accent, fontSize: t.fontSize.lg, fontWeight: t.fontWeight.regular }}>
                +
              </Text>
              <Text style={{ color: t.color.accent, fontSize: t.fontSize.md, fontWeight: t.fontWeight.semibold }}>
                Add subtask
              </Text>
            </Pressable>
          </View>

          {/*
            Other triggers (category / date / reminder / repeat) land in the next
            checkboxes.
          */}
          <View
            style={[
              styles.triggersPlaceholder,
              {
                borderTopColor: t.color.borderMuted,
                marginTop: t.spacing.lg,
                paddingTop: t.spacing.lg,
              },
            ]}
          >
            <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.xs, letterSpacing: t.tracking.wider }}>
              CATEGORY · DATE · REMINDER · REPEAT — coming next
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    fontWeight: '600',
    minHeight: 36,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 16,
    marginTop: 4,
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
  addSubtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  triggersPlaceholder: {
    borderTopWidth: 1,
  },
});
