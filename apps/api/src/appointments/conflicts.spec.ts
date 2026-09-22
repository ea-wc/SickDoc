import { describe, expect, it } from 'vitest';
import { ErrorCodes } from '@sickdoc/shared';
import { hasAppointmentConflict, validateBookingWindow } from './conflicts.js';

const now = new Date('2026-09-21T00:00:00.000Z');

describe('validateBookingWindow', () => {
  it('rejects a start in the past', () => {
    const result = validateBookingWindow({ startsAt: new Date(now.getTime() - 60_000), now });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(ErrorCodes.BUSINESS_RULE_VIOLATION);
  });

  it('accepts a slot in the future', () => {
    expect(validateBookingWindow({ startsAt: new Date(now.getTime() + 30 * 60_000), now }).ok).toBe(true);
  });

  it('accepts a slot within the horizon', () => {
    expect(validateBookingWindow({ startsAt: new Date(now.getTime() + 2 * 24 * 3600_000), now }).ok).toBe(true);
  });

  it('rejects starts beyond the 90-day horizon', () => {
    const result = validateBookingWindow({ startsAt: new Date(now.getTime() + 91 * 24 * 3600_000), now });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(ErrorCodes.BUSINESS_RULE_VIOLATION);
  });
});

describe('hasAppointmentConflict', () => {
  const appointment = { startsAt: new Date('2026-09-21T01:00:00.000Z'), endsAt: new Date('2026-09-21T01:30:00.000Z') };

  it('detects overlapping appointments', () => {
    expect(
      hasAppointmentConflict([appointment], new Date('2026-09-21T01:15:00.000Z'), new Date('2026-09-21T01:45:00.000Z')),
    ).toBe(true);
  });

  it('ignores appointments that merely touch (half-open interval)', () => {
    expect(
      hasAppointmentConflict([appointment], new Date('2026-09-21T01:30:00.000Z'), new Date('2026-09-21T02:00:00.000Z')),
    ).toBe(false);
  });

  it('returns false for an empty list', () => {
    expect(hasAppointmentConflict([], now, new Date(now.getTime() + 60_000))).toBe(false);
  });
});
