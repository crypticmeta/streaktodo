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
} from 'react-native';
import { useTheme } from '../theme';

type TaskComposerProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit?: (input: { title: string }) => Promise<void> | void;
};

const TITLE_MAX_LENGTH = 140;

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const keyboardOffset = useKeyboardOffset();

  // Reset content + focus the input every time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setSubmitting(false);
    setError(null);
    // Native autofocus is unreliable inside a Modal that just animated in.
    // A short delay after `visible` flips lets the modal mount before we ask
    // for focus.
    const id = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(id);
  }, [visible]);

  const trimmed = title.trim();
  const canSave = trimmed.length > 0 && !submitting;
  const remaining = TITLE_MAX_LENGTH - title.length;
  const showLengthHint = remaining <= 20;

  const handleTitleChange = (next: string) => {
    setTitle(next);
    if (error) setError(null);
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
      await onSubmit?.({ title: trimmed });
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

          {/*
            Trigger row (category / date / reminder / repeat / subtasks) lands in the
            next checkboxes. Each is a small Pressable rendered here in order.
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
              CATEGORY · DATE · REMINDER · REPEAT · SUBTASKS — coming next
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
  triggersPlaceholder: {
    borderTopWidth: 1,
  },
});
