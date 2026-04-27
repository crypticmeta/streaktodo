import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Category } from '../db';
import { useTheme } from '../theme';

type Anchor = {
  /** Distance from the LEFT edge of the screen to the menu's left edge. */
  left: number;
  /** Distance from the BOTTOM edge of the screen to the menu's bottom edge. */
  bottom: number;
};

type CategoryPickerMenuProps = {
  visible: boolean;
  onClose: () => void;
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Where to anchor the menu. Caller computes from chip's measured layout. */
  anchor: Anchor;
  /** Tapping "+ Create New" — caller opens its own form. */
  onCreateNew: () => void;
};

const MIN_WIDTH = 220;
const MAX_HEIGHT = 320;

// Tooltip-style anchored menu, matching inspiration/app/click_on_category.jpeg.
// Renders inside a transparent Modal so it floats above the composer keyboard.
// `anchor` is in screen coordinates; the parent is responsible for measuring
// the trigger and computing where the menu should sit.
export function CategoryPickerMenu({
  visible,
  onClose,
  categories,
  selectedId,
  onSelect,
  anchor,
  onCreateNew,
}: CategoryPickerMenuProps) {
  const t = useTheme();

  const choose = (id: string | null) => {
    onSelect(id);
    onClose();
  };

  const handleCreateNew = () => {
    onClose();
    onCreateNew();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close category menu" />
      <View
        style={[
          styles.card,
          {
            left: anchor.left,
            bottom: anchor.bottom,
            backgroundColor: t.color.surfaceRaised,
            borderRadius: t.radius.lg,
            ...t.elevation.lg,
            shadowColor: '#000',
            borderColor: t.color.border,
          },
        ]}
      >
        <ScrollView style={{ maxHeight: MAX_HEIGHT }} showsVerticalScrollIndicator={false}>
          <Row
            label="No Category"
            selected={selectedId === null}
            onPress={() => choose(null)}
          />
          {categories.map((c) => (
            <Row
              key={c.id}
              label={c.name}
              selected={selectedId === c.id}
              onPress={() => choose(c.id)}
            />
          ))}
          <Row
            label="+ Create New"
            selected={false}
            highlight
            onPress={handleCreateNew}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

function Row({
  label,
  selected,
  highlight,
  onPress,
}: {
  label: string;
  selected: boolean;
  highlight?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const color = selected || highlight ? t.color.accent : t.color.textPrimary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: t.color.surfaceMuted },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text
        style={{
          color,
          fontSize: t.fontSize.md,
          fontWeight: selected || highlight ? t.fontWeight.semibold : t.fontWeight.regular,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject },
  card: {
    position: 'absolute',
    minWidth: MIN_WIDTH,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
});
