import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateOnlyString,
  eachDate,
  isDateOnly,
  timezoneOffsetMs,
  utcToLocalDateString,
  utcToLocalMinuteOfDay,
  wallTimeToUtc,
  weekdayOf,
} from './timezone.js';

const MANILA = 'Asia/Manila';

describe('timezone helpers', () => {
  it('reports the UTC offset of a timezone at an instant', () => {
    expect(timezoneOffsetMs(MANILA, Date.parse('2026-09-21T00:00:00.000Z'))).toBe(8 * 3600_000);
  });

  it('converts a wall-clock local time to a UTC Date', () => {
    // 09:00 in Manila (UTC+8) on 2026-09-21 is 01:00 UTC.
    expect(wallTimeToUtc(MANILA, '2026-09-21', 540).toISOString()).toBe('2026-09-21T01:00:00.000Z');
  });

  it('formats a UTC instant as a local calendar date', () => {
    expect(utcToLocalDateString(MANILA, new Date('2026-09-20T16:00:00.000Z'))).toBe('2026-09-21');
  });

  it('computes the local minute-of-day for a UTC instant', () => {
    expect(utcToLocalMinuteOfDay(MANILA, new Date('2026-09-21T01:00:00.000Z'))).toBe(540);
  });

  it('derives the weekday of a date-only string', () => {
    expect(weekdayOf('2026-09-21')).toBe(1); // Monday
  });

  it('enumerates each date inclusively', () => {
    expect(eachDate('2026-09-21', '2026-09-23')).toEqual(['2026-09-21', '2026-09-22', '2026-09-23']);
  });

  it('formats a Date as a date-only string from its UTC fields', () => {
    expect(dateOnlyString(new Date('2026-09-21T10:30:00.000Z'))).toBe('2026-09-21');
  });

  it('recognises date-only strings', () => {
    expect(isDateOnly('2026-09-21')).toBe(true);
    expect(isDateOnly('2026-9-21')).toBe(false);
    expect(isDateOnly('not-a-date')).toBe(false);
  });

  it('adds days to a Date', () => {
    expect(addDays(new Date('2026-09-21T00:00:00.000Z'), 2).toISOString()).toBe('2026-09-23T00:00:00.000Z');
  });
});
