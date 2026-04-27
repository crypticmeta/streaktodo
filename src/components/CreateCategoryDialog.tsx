import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { palette, useTheme } from '../theme';

type CreateCategoryDialogProps = {
  visible: boolean;
  onCancel: () => void;
  /** Called with the trimmed name + chosen color. */
  onCreate: (input: { name: string; color: string }) => Promise<void> | void;
};

// A pre-curated palette of category colors. Matches the existing category
// defaults (evergreen / amber / crimson) and adds a few more to choose from.
// Keeping the list short on purpose — V0 doesn't need a full color picker.
const COLORS: ReadonlyArray<string> = [
  palette.evergreen[400],
  palette.amber[500],
  palette.crimson[500],
  palette.evergreen[700],
  '#5b6c89',
  '#7a4c8a',
  '#2f7d4d',
  '#c1592b',
];

const NAME_MAX_LENGTH = 28;

export function CreateCategoryDialog({ visible, onCancel, onCreate }: CreateCategoryDialogProps) {
  const t = useTheme();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(COLORS[0]!);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setColor(COLORS[0]!);
    setSubmitting(false);
  }, [visible]);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && !submitting;

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      await onCreate({ name: trimmed, color });
    } finally {
      setSubmitting(false);
    }
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
        accessibilityLabel="Close create category"
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
            Create category
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Category name"
            placeholderTextColor={t.color.textMuted}
            maxLength={NAME_MAX_LENGTH}
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
            {COLORS.map((c) => {
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
              accessibilityLabel="Create"
              accessibilityState={{ disabled: !canSave }}
              style={{ marginLeft: 24, opacity: canSave ? 1 : 0.45 }}
            >
              <Text style={{ color: t.color.accent, fontSize: t.fontSize.md, fontWeight: t.fontWeight.bold }}>
                {submitting ? 'CREATING…' : 'CREATE'}
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
