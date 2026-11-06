import { afterAll, describe, expect, it } from 'vitest';
import { dateKeyFromTimestamp, timestampFromDateKey } from '../date';
import { computeReminderFireAt, DEFAULT_REMINDER_TIME_MINUTES } from '../reminderTime';

const originalTz = process.env.TZ;
afterAll(() => { process.env.TZ = originalTz; });

describe('calendar dates and reminder time', () => {
  it('round-trips a stable calendar key', () => {
    const ts = new Date(2026, 7, 11, 18, 30).getTime();
    expect(dateKeyFromTimestamp(ts)).toBe('2026-08-11');
    expect(new Date(timestampFromDateKey('2026-08-11')).getHours()).toBe(0);
  });

  it('rejects impossible calendar dates', () => {
    expect(() => timestampFromDateKey('2026-02-31')).toThrow('Invalid calendar date');
    expect(() => dateKeyFromTimestamp(Number.NaN)).toThrow('Invalid timestamp');
  });

  it('uses wall-clock arithmetic across a DST transition', () => {
    process.env.TZ = 'America/New_York';
    const dueAt = new Date(2026, 2, 9, 0, 0, 0, 0).getTime();
    const fireAt = computeReminderFireAt({
      dueAt,
      dueTime: 9 * 60,
      leadMinutes: 24 * 60,
      nowTs: new Date(2026, 2, 1).getTime(),
    });
    expect(fireAt).toBe(new Date(2026, 2, 8, 9, 0, 0, 0).getTime());
  });

  it('rejects reminder times that have passed', () => {
    expect(computeReminderFireAt({
      dueAt: new Date(2026, 7, 11).getTime(),
      dueTime: 9 * 60,
      leadMinutes: 0,
      nowTs: new Date(2026, 7, 11, 10).getTime(),
    })).toBeNull();
  });

  it('uses the documented 09:00 fallback for an all-day reminder', () => {
    const dueAt = new Date(2026, 7, 12).getTime();
    const fireAt = computeReminderFireAt({
      dueAt,
      dueTime: null,
      leadMinutes: 15,
      nowTs: new Date(2026, 7, 11).getTime(),
    });
    const expected = new Date(2026, 7, 12, 8, 45).getTime();
    expect(DEFAULT_REMINDER_TIME_MINUTES).toBe(540);
    expect(fireAt).toBe(expected);
  });
});
