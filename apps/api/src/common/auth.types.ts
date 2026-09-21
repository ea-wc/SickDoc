import type { Role, UserStatus } from '@prisma/client';

/**
 * The identity attached to the request by {@link JwtAuthGuard}. It is loaded
 * fresh from the database on every authenticated request so that suspensions
 * and deactivations take effect immediately (docs/API_SPEC.md §1).
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  statusReason: string | null;
}

/** Access-token claims signed by the API. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}
