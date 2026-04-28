import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import * as analytics from '../lib/analytics';
import { useTheme, useThemePreference, type ColorSchemePreference } from '../theme';

const OPTIONS: ReadonlyArray<{
  key: ColorSchemePreference;
  label: string;
  icon: IconName;
}> = [
  { key: 'system', label: 'System', icon: 'theme-system' },
  { key: 'light', label: 'Light', icon: 'theme-light' },
  { key: 'dark', label: 'Dark', icon: 'theme-dark' },
];

export function ThemeToggle() {
  const t = useTheme();
  const { preference, setPreference } = useThemePreference();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: t.color.surface,
          borderRadius: t.radius.xl,
          padding: t.spacing.xl,
          gap: t.spacing.md,
        },
      ]}
    >
      <Text
        style={{
          color: t.color.textMuted,
          fontSize: t.fontSize.xs,
          fontWeight: t.fontWeight.semibold,
          letterSpacing: t.tracking.wide,
          textTransform: 'uppercase',
        }}
      >
        Appearance
      </Text>

      <View
        style={[
          styles.segmentRow,
          {
            backgroundColor: t.color.surfaceMuted,
            borderRadius: t.radius.lg,
            padding: 4,
          },
        ]}
      >
        {OPTIONS.map((opt) => {
          const active = preference === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => {
                setPreference(opt.key);
                void analytics.track('theme_changed', { preference: opt.key });
              }}
              style={[
                styles.segment,
                {
                  backgroundColor: active ? t.color.surface : 'transparent',
                  borderRadius: t.radius.md,
                  ...(active ? t.elevation.sm : null),
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={opt.label}
            >
              <Icon
                name={opt.icon}
                size={16}
                color={active ? t.color.accent : t.color.textMuted}
              />
              <Text
                style={{
                  color: active ? t.color.textPrimary : t.color.textMuted,
                  fontSize: t.fontSize.sm,
                  fontWeight: active ? t.fontWeight.semibold : t.fontWeight.medium,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  segmentRow: {
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
});
