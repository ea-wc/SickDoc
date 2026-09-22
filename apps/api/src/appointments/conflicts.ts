/** Pure booking-conflict rules, unit-tested independently of the database. */
import type { ErrorCode } from '@sickdoc/shared';
import { ErrorCodes } from '@sickdoc/shared';

export const BOOKING_HORIZON_DAYS = 90;

const DAY = 24 * 3600_000;

export function isOverlappingMs(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export interface BookingWindowInput {
  startsAt: Date;
  now: Date;
}

export type BookingWindowResult = { ok: true } | { ok: false; code: ErrorCode; message: string };

/** Asserts the requested start is in the future and within the booking horizon. */
export function validateBookingWindow(input: BookingWindowInput): BookingWindowResult {
  const start = input.startsAt.getTime();
  if (start < input.now.getTime()) {
    return { ok: false, code: ErrorCodes.BUSINESS_RULE_VIOLATION, message: 'The requested time is in the past' };
  }
  if (start > input.now.getTime() + BOOKING_HORIZON_DAYS * DAY) {
    return { ok: false, code: ErrorCodes.BUSINESS_RULE_VIOLATION, message: 'The requested time is beyond the booking horizon' };
  }
  return { ok: true };
}

/** True when any appointment in `appointments` overlaps [startsAt, endsAt). */
export function hasAppointmentConflict(
  appointments: { startsAt: Date; endsAt: Date }[],
  startsAt: Date,
  endsAt: Date,
): boolean {
  return appointments.some((appointment) =>
    isOverlappingMs(startsAt.getTime(), endsAt.getTime(), appointment.startsAt.getTime(), appointment.endsAt.getTime()),
  );
}
