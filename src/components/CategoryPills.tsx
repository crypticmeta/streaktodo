import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Category } from '../db';
import { useTheme } from '../theme';

type CategoryPillsProps = {
  categories: ReadonlyArray<Category>;
  /** null = "All" (no filter). */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function CategoryPills({ categories, selectedId, onSelect }: CategoryPillsProps) {
  const t = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.row,
        { paddingHorizontal: t.spacing.xl, gap: t.spacing.sm },
      ]}
    >
      <Pill
        label="All"
        selected={selectedId === null}
        onPress={() => onSelect(null)}
        dotColor={null}
      />
      {categories.map((c) => (
        <Pill
          key={c.id}
          label={c.name}
          selected={selectedId === c.id}
          onPress={() => onSelect(c.id)}
          dotColor={c.color}
        />
      ))}
    </ScrollView>
  );
}

function Pill({
  label,
  selected,
  onPress,
  dotColor,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  dotColor: string | null;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} filter`}
      style={({ pressed }) => [
        styles.pill,
        {
          borderColor: selected ? t.color.accent : t.color.borderStrong,
          backgroundColor: selected
            ? t.color.accent
            : pressed
              ? t.color.surfaceMuted
              : t.color.surface,
          borderRadius: t.radius.pill,
          paddingHorizontal: t.spacing.lg,
          paddingVertical: t.spacing.sm,
        },
      ]}
    >
      {dotColor ? (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: dotColor,
            marginRight: 8,
          }}
        />
      ) : null}
      <Text
        style={{
          color: selected ? t.color.textOnAccent : t.color.textSecondary,
          fontSize: t.fontSize.sm,
          fontWeight: selected ? t.fontWeight.bold : t.fontWeight.semibold,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
});
