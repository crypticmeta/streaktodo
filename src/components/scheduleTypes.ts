import type { ReminderType, RepeatFrequency } from '../db';

// ─── Reminder draft ─────────────────────────────────────────────────────

/** Reminder lead-time options surfaced in the Reminder popover. */
export const REMINDER_LEAD_OPTIONS = [
  { minutes: 0,    label: 'At time' },
  { minutes: 5,    label: '5 minutes before' },
  { minutes: 15,   label: '15 minutes before' },
  { minutes: 30,   label: '30 minutes before' },
  { minutes: 60,   label: '1 hour before' },
  { minutes: 1440, label: '1 day before' },
] as const;

export type ReminderLeadMinutes = (typeof REMINDER_LEAD_OPTIONS)[number]['minutes'];

export type ReminderDraft = {
  enabled: boolean;
  leadMinutes: number;            // matches REMINDER_LEAD_OPTIONS but kept open for custom values later
  type: ReminderType;             // 'notification' (free) | 'silent' | 'alarm' (premium-flagged)
  screenLock: boolean;            // premium-flagged
};

export const DEFAULT_REMINDER: ReminderDraft = {
  enabled: false,
  leadMinutes: 5,
  type: 'notification',
  screenLock: false,
};

// ─── Repeat draft ───────────────────────────────────────────────────────

/** Repeat preset choices. 'none' = no repeat. 'custom' = user opened the
 *  custom-rule sheet and configured a non-preset rule. */
export type RepeatPreset = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

/** Body of a custom rule. The underlying frequency unit can still be one of
 *  the standard four — the difference vs. a preset is that the user has
 *  customized at least one of intervalN / weekday set / day-of-month / until. */
export type CustomRepeatBody = {
  freq: Exclude<RepeatFrequency, 'custom'>;
  /** every N units; clamped >= 1 at the runtime layer */
  intervalN: number;
  /** CSV like "MO,WE,FR"; relevant for weekly */
  byWeekday?: string;
  /** 1..31; relevant for monthly/yearly */
  byMonthDay?: number;
  /** 1..12; relevant for yearly */
  byMonth?: number;
};

export type RepeatDraft = {
  preset: RepeatPreset;
  /** For 'custom': underlying repeat fields. Ignored for other presets. */
  custom?: CustomRepeatBody;
  /** Optional end date (start-of-day epoch ms). Applies to ANY preset, not
   *  only custom. The runtime stops spawning occurrences once this passes. */
  untilAt?: number | null;
};

export const DEFAULT_REPEAT: RepeatDraft = { preset: 'none' };

// ─── Combined schedule draft (returned by the Schedule sheet) ───────────

export type ScheduleDraft = {
  dueAt: number | null;          // epoch ms, start of day; null = no date
  dueTime: number | null;        // minutes since midnight; null = all-day
  reminder: ReminderDraft;
  repeat: RepeatDraft;
};

export const EMPTY_SCHEDULE: ScheduleDraft = {
  dueAt: null,
  dueTime: null,
  reminder: DEFAULT_REMINDER,
  repeat: DEFAULT_REPEAT,
};

/**
 * Reminder popover requires a dueAt+dueTime to function (otherwise we have
 * nothing to schedule from). Helper so UI can show the "set a date first" hint.
 */
export function canConfigureReminder(draft: ScheduleDraft): boolean {
  return draft.dueAt !== null;
}
