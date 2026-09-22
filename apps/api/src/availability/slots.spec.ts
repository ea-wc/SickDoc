import { describe, expect, it } from 'vitest';
import { deriveSlots, findBookableSlot, findSlot, isOverlapping, SlotRuleInput } from './slots.js';

const MANILA = 'Asia/Manila';
const PAST = new Date('2026-09-20T00:00:00.000Z');

function rule(weekday: number, startMinute: number, endMinute: number, slotMinutes = 30): SlotRuleInput {
  return { weekday, startMinute, endMinute, slotMinutes };
}

describe('deriveSlots', () => {
  it('expands a rule into 30-minute UTC slots', () => {
    const days = deriveSlots({
      rules: [rule(1, 540, 1020)],
      exceptions: [],
      appointments: [],
      from: '2026-09-21',
      to: '2026-09-21',
      timeZone: MANILA,
      now: PAST,
    });
    expect(days).toHaveLength(1);
    const slots = days[0].slots;
    expect(slots).toHaveLength(16); // 09:00–16:30 local
    expect(slots[0].startsAt.toISOString()).toBe('2026-09-21T01:00:00.000Z');
    expect(slots[0].endsAt.toISOString()).toBe('2026-09-21T01:30:00.000Z');
    expect(slots.every((slot) => slot.available)).toBe(true);
  });

  it('subtracts exception overlaps', () => {
    const days = deriveSlots({
      rules: [rule(1, 540, 1020)],
      exceptions: [{ startsAt: new Date('2026-09-21T01:30:00.000Z'), endsAt: new Date('2026-09-21T03:00:00.000Z') }],
      appointments: [],
      from: '2026-09-21',
      to: '2026-09-21',
      timeZone: MANILA,
      now: PAST,
    });
    expect(days[0].slots.filter((slot) => slot.available)).toHaveLength(13);
  });

  it('subtracts active appointment overlaps', () => {
    const days = deriveSlots({
      rules: [rule(1, 540, 1020)],
      exceptions: [],
      appointments: [{ startsAt: new Date('2026-09-21T01:00:00.000Z'), endsAt: new Date('2026-09-21T01:30:00.000Z') }],
      from: '2026-09-21',
      to: '2026-09-21',
      timeZone: MANILA,
      now: PAST,
    });
    expect(findSlot(days, new Date('2026-09-21T01:00:00.000Z'))?.available).toBe(false);
    expect(findSlot(days, new Date('2026-09-21T01:30:00.000Z'))?.available).toBe(true);
  });

  it('blocks slots that have already started', () => {
    const days = deriveSlots({
      rules: [rule(1, 540, 1020)],
      exceptions: [],
      appointments: [],
      from: '2026-09-21',
      to: '2026-09-21',
      timeZone: MANILA,
      now: new Date('2026-09-21T01:05:00.000Z'),
    });
    expect(findSlot(days, new Date('2026-09-21T01:00:00.000Z'))?.available).toBe(false);
    expect(findSlot(days, new Date('2026-09-21T01:30:00.000Z'))?.available).toBe(true);
  });

  it('honours rule effective dates', () => {
    const days = deriveSlots({
      rules: [
        { weekday: 2, startMinute: 540, endMinute: 1020, slotMinutes: 30, effectiveFrom: '2026-09-22', effectiveTo: '2026-09-22' },
      ],
      exceptions: [],
      appointments: [],
      from: '2026-09-21',
      to: '2026-09-22',
      timeZone: MANILA,
      now: PAST,
    });
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe('2026-09-22');
  });

  it('findBookableSlot only returns available slots', () => {
    const days = deriveSlots({
      rules: [rule(1, 540, 1020)],
      exceptions: [],
      appointments: [{ startsAt: new Date('2026-09-21T01:00:00.000Z'), endsAt: new Date('2026-09-21T01:30:00.000Z') }],
      from: '2026-09-21',
      to: '2026-09-21',
      timeZone: MANILA,
      now: PAST,
    });
    expect(findBookableSlot(days, new Date('2026-09-21T01:00:00.000Z'))).toBeUndefined();
    expect(findBookableSlot(days, new Date('2026-09-21T01:30:00.000Z'))).toBeDefined();
  });

  it('findSlot returns undefined when no slot starts at the given instant', () => {
    const days = deriveSlots({
      rules: [rule(1, 540, 1020)],
      exceptions: [],
      appointments: [],
      from: '2026-09-21',
      to: '2026-09-21',
      timeZone: MANILA,
      now: PAST,
    });
    expect(findSlot(days, new Date('2026-09-22T01:00:00.000Z'))).toBeUndefined();
  });

  it('defaults a falsy slot length to 30 minutes', () => {
    const days = deriveSlots({
      rules: [{ weekday: 1, startMinute: 540, endMinute: 600, slotMinutes: 0 }],
      exceptions: [],
      appointments: [],
      from: '2026-09-21',
      to: '2026-09-21',
      timeZone: MANILA,
      now: PAST,
    });
    expect(days[0].slots).toHaveLength(2); // 09:00–10:00 in 30-minute slots
  });

  it('skips rules outside their effective date window', () => {
    const days = deriveSlots({
      rules: [
        { weekday: 1, startMinute: 540, endMinute: 1020, slotMinutes: 30, effectiveFrom: '2026-09-22', effectiveTo: '2026-09-22' },
        { weekday: 1, startMinute: 540, endMinute: 600, slotMinutes: 30, effectiveTo: '2026-09-20' },
      ],
      exceptions: [],
      appointments: [],
      from: '2026-09-21',
      to: '2026-09-21',
      timeZone: MANILA,
      now: PAST,
    });
    expect(days).toHaveLength(0);
  });

  it('isOverlapping detects overlaps but not merely touching intervals', () => {
    expect(
      isOverlapping(
        new Date('2026-09-21T01:00:00.000Z'),
        new Date('2026-09-21T02:00:00.000Z'),
        new Date('2026-09-21T01:30:00.000Z'),
        new Date('2026-09-21T02:30:00.000Z'),
      ),
    ).toBe(true);
    expect(
      isOverlapping(
        new Date('2026-09-21T01:00:00.000Z'),
        new Date('2026-09-21T01:30:00.000Z'),
        new Date('2026-09-21T01:30:00.000Z'),
        new Date('2026-09-21T02:00:00.000Z'),
      ),
    ).toBe(false);
  });
});
