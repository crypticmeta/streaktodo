import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '../../src/theme';

type GlyphProps = { glyph: string; color: string };

function TabGlyph({ glyph, color }: GlyphProps) {
  // Placeholder icon system. Phase 2 will swap this for @expo/vector-icons
  // (or a custom Icon component) once we settle on a library.
  return (
    <Text style={{ fontSize: 22, color, lineHeight: 26 }}>{glyph}</Text>
  );
}

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.color.background },
        headerTitleStyle: {
          color: theme.color.textPrimary,
          fontSize: theme.fontSize.lg,
          fontWeight: theme.fontWeight.semibold,
        },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.border,
          height: 64,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.sm,
        },
        tabBarActiveTintColor: theme.color.accent,
        tabBarInactiveTintColor: theme.color.textMuted,
        tabBarLabelStyle: {
          fontSize: theme.fontSize.xs,
          fontWeight: theme.fontWeight.semibold,
          letterSpacing: theme.tracking.wide,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => <TabGlyph glyph="✓" color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <TabGlyph glyph="▦" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabGlyph glyph="◉" color={color} />,
        }}
      />
    </Tabs>
  );
}
