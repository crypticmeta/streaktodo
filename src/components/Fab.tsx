import { Pressable, StyleSheet, Text, View, type AccessibilityProps } from 'react-native';
import { useTheme } from '../theme';

type FabProps = {
  onPress: () => void;
  glyph?: string;
  accessibilityLabel: string;          // required: this button has no visible text label
  hint?: AccessibilityProps['accessibilityHint'];
  disabled?: boolean;
};

const SIZE = 60;
const HALO_PADDING = 8; // halo is SIZE + 2*HALO_PADDING wide

// Standalone circular floating action button. Lives at bottom-right of any
// screen that mounts it — caller is responsible for rendering it as a sibling
// of the scrollable content (so it floats above the list).
export function Fab({ onPress, glyph = '+', accessibilityLabel, hint, disabled }: FabProps) {
  const t = useTheme();

  return (
    // Halo: a slightly larger soft-accent circle sitting behind the button.
    // Gives the FAB a glow without resorting to platform-specific shadow tricks.
    <View
      pointerEvents="box-none"
      style={[
        styles.halo,
        {
          backgroundColor: t.color.accentSoft,
          opacity: 0.55,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={hint}
        hitSlop={8}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: t.color.accent,
            ...t.elevation.lg,
            shadowColor: t.color.accent,
          },
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <Text
          style={{
            color: t.color.textOnAccent,
            fontSize: 28,
            fontWeight: t.fontWeight.regular,
            lineHeight: 32,
            marginTop: -2,                // optical centering for a "+" glyph
          }}
        >
          {glyph}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    position: 'absolute',
    right: 20 - HALO_PADDING,
    bottom: 20 - HALO_PADDING,
    width: SIZE + HALO_PADDING * 2,
    height: SIZE + HALO_PADDING * 2,
    borderRadius: (SIZE + HALO_PADDING * 2) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
