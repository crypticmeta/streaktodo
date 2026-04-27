import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme';
import { CATEGORY_COLORS, CATEGORY_NAME_MAX_LENGTH } from './categoryColors';

type EditCategoryDialogProps = {
  visible: boolean;
  /** Pre-populated values when the dialog opens. */
  initial: { name: string; color: string | null } | null;
  onCancel: () => void;
  onSave: (input: { name: string; color: string }) => Promise<void> | void;
};

export function EditCategoryDialog({ visible, initial, onCancel, onSave }: EditCategoryDialogProps) {
  const t = useTheme();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(CATEGORY_COLORS[0]!);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? '');
    // Keep the existing color if it matches our palette; otherwise still
    // show it as selected by adding to the rendered palette inline.
    setColor(initial?.color ?? CATEGORY_COLORS[0]!);
    setSubmitting(false);
  }, [visible, initial]);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && !submitting;

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      await onSave({ name: trimmed, color });
    } finally {
      setSubmitting(false);
    }
  };

  // If the initial color isn't in our palette, prepend it so the user sees
  // their existing color highlighted instead of getting silently re-mapped.
  const palette = (() => {
    if (!initial?.color) return CATEGORY_COLORS;
    if (CATEGORY_COLORS.includes(initial.color)) return CATEGORY_COLORS;
    return [initial.color, ...CATEGORY_COLORS];
  })();

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
        accessibilityLabel="Close edit category"
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
          <Text
            style={{
              color: t.color.textPrimary,
              fontSize: t.fontSize.lg,
              fontWeight: t.fontWeight.bold,
              marginBottom: t.spacing.lg,
            }}
          >
            Edit category
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Category name"
            placeholderTextColor={t.color.textMuted}
            maxLength={CATEGORY_NAME_MAX_LENGTH}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
            style={[
              styles.input,
              {
                color: t.color.textPrimary,
                fontSize: t.fontSize.md,
                borderColor: t.color.border,
                borderRadius: t.radius.md,
                paddingHorizontal: t.spacing.md,
                paddingVertical: t.spacing.sm,
                backgroundColor: t.color.surface,
              },
            ]}
          />

          <Text
            style={{
              color: t.color.textMuted,
              fontSize: t.fontSize.xs,
              fontWeight: t.fontWeight.semibold,
              textTransform: 'uppercase',
              letterSpacing: t.tracking.wider,
              marginTop: t.spacing.lg,
              marginBottom: t.spacing.sm,
            }}
          >
            Color
          </Text>
          <View style={styles.swatches}>
            {palette.map((c) => {
              const selected = c === color;
              return (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Color ${c}`}
                  accessibilityState={{ selected }}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: c,
                      borderColor: selected ? t.color.textPrimary : 'transparent',
                    },
                  ]}
                />
              );
            })}
          </View>

          <View style={[styles.footer, { marginTop: t.spacing['2xl'] }]}>
            <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text style={{ color: t.color.textMuted, fontSize: t.fontSize.md, fontWeight: t.fontWeight.semibold }}>
                CANCEL
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Save"
              accessibilityState={{ disabled: !canSave }}
              style={{ marginLeft: 24, opacity: canSave ? 1 : 0.45 }}
            >
              <Text style={{ color: t.color.accent, fontSize: t.fontSize.md, fontWeight: t.fontWeight.bold }}>
                {submitting ? 'SAVING…' : 'SAVE'}
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
    maxWidth: 420,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
