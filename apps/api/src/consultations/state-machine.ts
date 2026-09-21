/** Pure consultation session state machine (docs/ARCHITECTURE.md §6.4). */
import { SessionStatus } from '@prisma/client';

export type SessionAction = 'join' | 'start' | 'complete' | 'no-show';

export interface TransitionContext {
  patientJoined: boolean;
  now: Date;
  endsAt: Date;
}

export type TransitionResult =
  | { ok: true; to: SessionStatus }
  | { ok: false; code: 'INVALID_STATE_TRANSITION' | 'BUSINESS_RULE_VIOLATION'; message: string };

function invalid(from: SessionStatus, attempted: string): TransitionResult {
  return {
    ok: false,
    code: 'INVALID_STATE_TRANSITION',
    message: `Cannot move from ${from} to ${attempted}`,
  };
}

/**
 * Allowed transitions:
 *   join:     SCHEDULED → JOINED, JOINED → JOINED (second participant)
 *   start:    JOINED → IN_PROGRESS   (doctor)
 *   complete: IN_PROGRESS → COMPLETED (doctor)
 *   no-show:  SCHEDULED → NO_SHOW    (doctor, patient absent, grace passed)
 */
export function transition(from: SessionStatus, action: SessionAction, ctx: TransitionContext): TransitionResult {
  switch (action) {
    case 'join':
      if (from === SessionStatus.SCHEDULED || from === SessionStatus.JOINED) {
        return { ok: true, to: SessionStatus.JOINED };
      }
      return invalid(from, 'JOINED');
    case 'start':
      if (from !== SessionStatus.JOINED) {
        return invalid(from, 'IN_PROGRESS');
      }
      return { ok: true, to: SessionStatus.IN_PROGRESS };
    case 'complete':
      if (from !== SessionStatus.IN_PROGRESS) {
        return invalid(from, 'COMPLETED');
      }
      return { ok: true, to: SessionStatus.COMPLETED };
    case 'no-show':
      if (from !== SessionStatus.SCHEDULED) {
        return invalid(from, 'NO_SHOW');
      }
      if (ctx.patientJoined) {
        return { ok: false, code: 'BUSINESS_RULE_VIOLATION', message: 'The patient has already joined' };
      }
      if (ctx.now.getTime() < ctx.endsAt.getTime()) {
        return { ok: false, code: 'BUSINESS_RULE_VIOLATION', message: 'The grace period has not passed yet' };
      }
      return { ok: true, to: SessionStatus.NO_SHOW };
  }
}
