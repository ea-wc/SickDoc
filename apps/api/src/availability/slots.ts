/**
 * Pure slot derivation (docs/ARCHITECTURE.md §6.1):
 *
 *   slots = expand(rules) − overlaps(exceptions)
 *                        − overlaps(active appointments)
 *                        − slots that have already started
 *
 * Slots are computed, never stored. This module is pure so it can be unit
 * tested without a database or a fixed system timezone.
 */
import { eachDate, wallTimeToUtc, weekdayOf } from './timezone.js';

export interface SlotRuleInput {
  weekday: number;
  startMinute: number;
  endMinute: number;
  slotMinutes: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}

export interface SlotInstant {
  startsAt: Date;
  endsAt: Date;
  available: boolean;
}

export interface DerivedDay {
  date: string;
  slots: SlotInstant[];
}

export interface DeriveSlotsInput {
  rules: SlotRuleInput[];
  exceptions: { startsAt: Date; endsAt: Date }[];
  appointments: { startsAt: Date; endsAt: Date }[];
  from: string;
  to: string;
  timeZone: string;
  now: Date;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function deriveSlots(input: DeriveSlotsInput): DerivedDay[] {
  const leadCutoff = input.now.getTime();
  const blockedRanges = [
    ...input.exceptions.map((e) => ({ start: e.startsAt.getTime(), end: e.endsAt.getTime() })),
    ...input.appointments.map((a) => ({ start: a.startsAt.getTime(), end: a.endsAt.getTime() })),
  ];

  const days: DerivedDay[] = [];
  for (const date of eachDate(input.from, input.to)) {
    const weekday = weekdayOf(date);
    const slots: SlotInstant[] = [];
    for (const rule of input.rules) {
      if (rule.weekday !== weekday) continue;
      if (rule.effectiveFrom && date < rule.effectiveFrom) continue;
      if (rule.effectiveTo && date > rule.effectiveTo) continue;
      const slotMinutes = Math.max(1, rule.slotMinutes || 30);
      for (let m = rule.startMinute; m + slotMinutes <= rule.endMinute; m += slotMinutes) {
        const startsAt = wallTimeToUtc(input.timeZone, date, m);
        const endsAt = wallTimeToUtc(input.timeZone, date, m + slotMinutes);
        const start = startsAt.getTime();
        const end = endsAt.getTime();
        const blocked =
          start < leadCutoff || blockedRanges.some((range) => overlaps(start, end, range.start, range.end));
        slots.push({ startsAt, endsAt, available: !blocked });
      }
    }
    if (slots.length > 0) days.push({ date, slots });
  }
  return days;
}

/** Finds the generated slot starting exactly at `startsAt` (whether available or not). */
export function findSlot(days: DerivedDay[], startsAt: Date): SlotInstant | undefined {
  const target = startsAt.getTime();
  for (const day of days) {
    for (const slot of day.slots) {
      if (slot.startsAt.getTime() === target) return slot;
    }
  }
  return undefined;
}

/** Finds the generated slot starting exactly at `startsAt` that is still bookable. */
export function findBookableSlot(days: DerivedDay[], startsAt: Date): SlotInstant | undefined {
  const slot = findSlot(days, startsAt);
  return slot?.available ? slot : undefined;
}

/** Returns true when [aStart, aEnd) overlaps [bStart, bEnd). */
export function isOverlapping(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return overlaps(aStart.getTime(), aEnd.getTime(), bStart.getTime(), bEnd.getTime());
}
