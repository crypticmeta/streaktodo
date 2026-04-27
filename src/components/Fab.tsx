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
const HALO_PADDING = 8; // halo extends this far past the button on every side

// Standalone circular floating action button. Lives at bottom-right of any
// screen that mounts it — caller is responsible for rendering it as a sibling
// of the scrollable content (so it floats above the list).
//
// Structure mirrors the CSS pattern from design-system/preview/comp-fab.html:
//   .fab-wrap (clear positioner, no opacity)
//     .fab-wrap::before  (halo: accent-soft circle at 0.55 opacity)
//     .fab               (button: full-opacity accent fill)
//
// In RN we can't use pseudo-elements, so we render the halo and the button
// as siblings inside a positioner that itself has no opacity. This keeps the
// halo soft without fading the charcoal center of the button.
export function Fab({ onPress, glyph = '+', accessibilityLabel, hint, disabled }: FabProps) {
  const t = useTheme();
  const wrapSize = SIZE + HALO_PADDING * 2;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          width: wrapSize,
          height: wrapSize,
          borderRadius: wrapSize / 2,
        },
      ]}
    >
      {/* Halo — soft accent circle behind the button. Owns its OWN opacity so
          the button rendering above it stays at full strength. */}
      <View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            backgroundColor: t.color.accentSoft,
            opacity: disabled ? 0.25 : 0.55,
            borderRadius: wrapSize / 2,
          },
        ]}
      />

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
  wrap: {
    position: 'absolute',
    right: 20 - HALO_PADDING,
    bottom: 20 - HALO_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
    // No opacity here — children manage their own.
  },
  halo: {
    ...StyleSheet.absoluteFillObject,
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
