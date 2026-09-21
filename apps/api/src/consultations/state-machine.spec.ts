import { describe, expect, it } from 'vitest';
import { SessionStatus } from '@prisma/client';
import { transition } from './state-machine.js';

const now = new Date('2026-09-21T02:00:00.000Z');
const endedAt = new Date('2026-09-21T01:30:00.000Z'); // in the past

describe('consultation session state machine', () => {
  it('allows join from SCHEDULED', () => {
    const result = transition(SessionStatus.SCHEDULED, 'join', { patientJoined: false, now, endsAt: endedAt });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.to).toBe(SessionStatus.JOINED);
  });

  it('allows the second participant to join from JOINED', () => {
    const result = transition(SessionStatus.JOINED, 'join', { patientJoined: true, now, endsAt: endedAt });
    expect(result.ok).toBe(true);
  });

  it('allows start only from JOINED', () => {
    expect(transition(SessionStatus.SCHEDULED, 'start', { patientJoined: true, now, endsAt: endedAt }).ok).toBe(false);
    expect(transition(SessionStatus.JOINED, 'start', { patientJoined: true, now, endsAt: endedAt }).ok).toBe(true);
  });

  it('allows complete only from IN_PROGRESS', () => {
    expect(transition(SessionStatus.JOINED, 'complete', { patientJoined: true, now, endsAt: endedAt }).ok).toBe(false);
    expect(transition(SessionStatus.IN_PROGRESS, 'complete', { patientJoined: true, now, endsAt: endedAt }).ok).toBe(true);
  });

  it('rejects no-show when the patient has joined', () => {
    const result = transition(SessionStatus.SCHEDULED, 'no-show', { patientJoined: true, now, endsAt: endedAt });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('BUSINESS_RULE_VIOLATION');
  });

  it('rejects no-show before the grace period has passed', () => {
    const result = transition(SessionStatus.SCHEDULED, 'no-show', {
      patientJoined: false,
      now,
      endsAt: new Date('2026-09-21T03:00:00.000Z'),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('BUSINESS_RULE_VIOLATION');
  });

  it('allows no-show after the grace period with no patient join', () => {
    const result = transition(SessionStatus.SCHEDULED, 'no-show', { patientJoined: false, now, endsAt: endedAt });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.to).toBe(SessionStatus.NO_SHOW);
  });

  it('rejects transitions from terminal states', () => {
    const result = transition(SessionStatus.COMPLETED, 'complete', { patientJoined: true, now, endsAt: endedAt });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_STATE_TRANSITION');
  });
});
