import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Category } from '../db';
import { useTheme } from '../theme';

type CategoryPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  categories: Category[];
  /** Currently selected category id, or null for none. */
  selectedId: string | null;
  /** Pass null to clear the selection. */
  onSelect: (categoryId: string | null) => void;
};

// Bottom-sheet picker. Tap a row to choose; the parent decides whether to
// auto-close on selection (we do, here, by calling onClose after onSelect).
// Tap "No category" to clear.
export function CategoryPickerSheet({
  visible,
  onClose,
  categories,
  selectedId,
  onSelect,
}: CategoryPickerSheetProps) {
  const t = useTheme();

  const choose = (id: string | null) => {
    onSelect(id);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={[styles.scrim, { backgroundColor: t.color.scrim }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close category picker"
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
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: t.color.borderStrong, borderRadius: t.radius.pill }]} />

          <Text
            style={{
              color: t.color.textPrimary,
              fontSize: t.fontSize.lg,
              fontWeight: t.fontWeight.semibold,
              marginBottom: t.spacing.md,
            }}
          >
            Category
          </Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            <PickerRow
              label="No category"
              dotColor={null}
              selected={selectedId === null}
              onPress={() => choose(null)}
            />
            {categories.map((c) => (
              <PickerRow
                key={c.id}
                label={c.name}
                dotColor={c.color}
                selected={selectedId === c.id}
                onPress={() => choose(c.id)}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PickerRow({
  label,
  dotColor,
  selected,
  onPress,
}: {
  label: string;
  dotColor: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          paddingHorizontal: t.spacing.sm,
          paddingVertical: t.spacing.md,
          borderRadius: t.radius.lg,
          backgroundColor: pressed ? t.color.surfaceMuted : 'transparent',
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View
        style={[
          styles.dot,
          {
            backgroundColor: dotColor ?? 'transparent',
            borderColor: dotColor ?? t.color.borderStrong,
          },
        ]}
      />
      <Text
        style={{
          color: t.color.textPrimary,
          fontSize: t.fontSize.md,
          fontWeight: selected ? t.fontWeight.semibold : t.fontWeight.regular,
          flex: 1,
        }}
      >
        {label}
      </Text>
      {selected ? (
        <Text style={{ color: t.color.accent, fontSize: t.fontSize.lg, fontWeight: t.fontWeight.bold }}>
          ✓
        </Text>
      ) : null}
    </Pressable>
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
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    marginBottom: 12,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
});
