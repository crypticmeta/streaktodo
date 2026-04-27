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

/** Repeat preset choices. 'none' = no repeat. 'custom' is premium-flagged. */
export type RepeatPreset = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export type RepeatDraft = {
  preset: RepeatPreset;
  /** For 'custom': underlying repeat fields. Ignored for other presets. */
  custom?: {
    freq: RepeatFrequency;
    intervalN: number;          // every N units, default 1
    byWeekday?: string;         // CSV like "MO,WE,FR"
    byMonthDay?: number;
    byMonth?: number;
  };
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
