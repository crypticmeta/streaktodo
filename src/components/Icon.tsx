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
  // Tab bar — outlined for inactive, filled for active
  | 'tasks'
  | 'tasks-filled'
  | 'calendar-tab'
  | 'calendar-tab-filled'
  | 'profile'
  | 'profile-filled'
  // Row meta
  | 'reminder-filled'
  | 'repeat-filled'
  | 'star'
  | 'star-filled'
  | 'check'
  | 'close'
  | 'trash'
  // Theme toggle
  | 'theme-system'
  | 'theme-light'
  | 'theme-dark'
  // Category management
  | 'edit'
  | 'plus'
  // Disclosure
  | 'chevron-up'
  | 'chevron-down'
  // Row meta — notes indicator
  | 'note';

const MAP: Record<IconName, ComponentProps<typeof Ionicons>['name']> = {
  calendar: 'calendar-outline',
  subtask: 'list-outline',
  template: 'clipboard-outline',
  send: 'arrow-up',
  time: 'time-outline',
  reminder: 'notifications-outline',
  repeat: 'repeat',
  tasks: 'checkmark-circle-outline',
  'tasks-filled': 'checkmark-circle',
  'calendar-tab': 'calendar-outline',
  'calendar-tab-filled': 'calendar',
  profile: 'person-circle-outline',
  'profile-filled': 'person-circle',
  'reminder-filled': 'notifications',
  'repeat-filled': 'repeat',
  star: 'star-outline',
  'star-filled': 'star',
  check: 'checkmark',
  close: 'close',
  trash: 'trash-outline',
  'theme-system': 'phone-portrait-outline',
  'theme-light': 'sunny-outline',
  'theme-dark': 'moon-outline',
  edit: 'create-outline',
  plus: 'add',
  'chevron-up': 'chevron-up',
  'chevron-down': 'chevron-down',
  note: 'document-text-outline',
};

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 18, color }: IconProps) {
  return <Ionicons name={MAP[name]} size={size} color={color} />;
}
