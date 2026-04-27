import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Icon, type IconName } from '../../src/components/Icon';
import { useTheme } from '../../src/theme';

type TabConfig = {
  /** Outlined icon shown when the tab is NOT focused. */
  inactive: IconName;
  /** Filled icon shown when the tab IS focused. */
  active: IconName;
};

const TABS: Record<'tasks' | 'calendar' | 'profile', TabConfig> = {
  tasks:    { inactive: 'tasks',         active: 'tasks-filled' },
  calendar: { inactive: 'calendar-tab',  active: 'calendar-tab-filled' },
  profile:  { inactive: 'profile',       active: 'profile-filled' },
};

export default function TabsLayout() {
  const t = useTheme();

  // The active tab uses a FILLED icon variant + accent color + bold label.
  // The inactive tab uses an OUTLINED icon + textMuted + regular label.
  // This mirrors the standard iOS/Android pattern (Twitter, Instagram, Apple
  // Music) and creates a much stronger glance-able difference than swapping
  // colors alone.
  const renderIcon = (kind: keyof typeof TABS) =>
    ({ focused, color }: { focused: boolean; color: string }) => (
      <Icon
        name={focused ? TABS[kind].active : TABS[kind].inactive}
        size={focused ? 24 : 22}
        color={color}
      />
    );

  const renderLabel = (label: string) =>
    ({ focused, color }: { focused: boolean; color: string }) => (
      <Text
        style={{
          color,
          fontSize: t.fontSize.xs,
          fontWeight: focused ? t.fontWeight.bold : t.fontWeight.medium,
          letterSpacing: t.tracking.wide,
        }}
      >
        {label}
      </Text>
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: t.color.surface,
          borderTopColor: t.color.border,
          height: 64,
          paddingTop: t.spacing.sm,
          paddingBottom: t.spacing.sm,
        },
        tabBarActiveTintColor: t.color.accent,
        tabBarInactiveTintColor: t.color.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tasks',
          tabBarIcon: renderIcon('tasks'),
          tabBarLabel: renderLabel('Tasks'),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: renderIcon('calendar'),
          tabBarLabel: renderLabel('Calendar'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: renderIcon('profile'),
          tabBarLabel: renderLabel('Profile'),
        }}
      />
    </Tabs>
  );
}
