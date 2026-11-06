import { describe, expect, it } from 'vitest';
import { nextOccurrence } from '../recurrence';

const day = (year: number, month: number, date: number) => new Date(year, month, date).getTime();

describe('nextOccurrence', () => {
  it('keeps all selected weekdays inside an active interval week', () => {
    const anchor = day(2026, 7, 10); // Monday
    const next = nextOccurrence({
      freq: 'weekly',
      intervalN: 2,
      byWeekday: 'MO,WE',
      byMonthDay: null,
      byMonth: null,
      untilAt: null,
      anchorAt: anchor,
    }, anchor);
    expect(next).toBe(day(2026, 7, 12));
  });

  it('skips inactive weeks after the last selected weekday', () => {
    const anchor = day(2026, 7, 10);
    const next = nextOccurrence({
      freq: 'weekly', intervalN: 2, byWeekday: 'MO,WE',
      byMonthDay: null, byMonth: null, untilAt: null, anchorAt: anchor,
    }, day(2026, 7, 12));
    expect(next).toBe(day(2026, 7, 24));
  });

  it('keeps a custom two-month cadence monthly', () => {
    expect(nextOccurrence({
      freq: 'monthly', intervalN: 2, byWeekday: null,
      byMonthDay: 11, byMonth: null, untilAt: null,
    }, day(2026, 7, 11))).toBe(day(2026, 9, 11));
  });

  it('clamps month-end and returns to the requested month day', () => {
    expect(nextOccurrence({
      freq: 'monthly', intervalN: 1, byWeekday: null,
      byMonthDay: 31, byMonth: null, untilAt: null,
    }, day(2026, 0, 31))).toBe(day(2026, 1, 28));
    expect(nextOccurrence({
      freq: 'monthly', intervalN: 1, byWeekday: null,
      byMonthDay: 31, byMonth: null, untilAt: null,
    }, day(2026, 1, 28))).toBe(day(2026, 2, 31));
  });

  it('honours an inclusive end date', () => {
    expect(nextOccurrence({
      freq: 'daily', intervalN: 1, byWeekday: null,
      byMonthDay: null, byMonth: null, untilAt: day(2026, 7, 12),
    }, day(2026, 7, 12))).toBeNull();
  });
});
