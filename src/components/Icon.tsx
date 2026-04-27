import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

// Centralized icon component. We pick a small named set of icons here so the
// rest of the app doesn't import the underlying icon library directly. Change
// the mapping (or swap libraries entirely) without touching screens.

export type IconName =
  // Composer / schedule action icons
  | 'calendar'        // 📅 → calendar-outline
  | 'subtask'         // 🔗 → list-outline
  | 'template'        // 📋 → clipboard-outline (premium-flagged)
  | 'send'            // ▴ → arrow-up
  | 'time'            // 🕒 → time-outline
  | 'reminder'        // 🔔 → notifications-outline
  | 'repeat'          // 🔁 → repeat
  // Tab bar
  | 'tasks'
  | 'calendar-tab'
  | 'profile'
  // Row meta
  | 'reminder-filled'
  | 'repeat-filled'
  | 'star'
  | 'star-filled'
  | 'check'
  | 'close';

const MAP: Record<IconName, ComponentProps<typeof Ionicons>['name']> = {
  calendar: 'calendar-outline',
  subtask: 'list-outline',
  template: 'clipboard-outline',
  send: 'arrow-up',
  time: 'time-outline',
  reminder: 'notifications-outline',
  repeat: 'repeat',
  tasks: 'checkmark-circle-outline',
  'calendar-tab': 'calendar-outline',
  profile: 'person-circle-outline',
  'reminder-filled': 'notifications',
  'repeat-filled': 'repeat',
  star: 'star-outline',
  'star-filled': 'star',
  check: 'checkmark',
  close: 'close',
};

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 18, color }: IconProps) {
  return <Ionicons name={MAP[name]} size={size} color={color} />;
}
