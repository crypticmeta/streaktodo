import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
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
      />
      {categories.map((c) => (
        <Pill
          key={c.id}
          label={c.name}
          selected={selectedId === c.id}
          onPress={() => onSelect(c.id)}
        />
      ))}
    </ScrollView>
  );
}

function Pill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
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
          backgroundColor: selected
            ? t.color.accent
            : pressed
              ? t.color.accentMuted
              : t.color.surfaceMuted,
          borderRadius: t.radius.pill,
          paddingHorizontal: t.spacing.lg,
          paddingVertical: 10,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? t.color.textOnAccent : t.color.textPrimary,
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
    paddingTop: 4,
    paddingBottom: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
