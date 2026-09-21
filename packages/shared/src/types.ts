import type { DoctorStatus, Role, UserStatus } from './enums';
import type { ErrorCode } from './errors';

/** Wire shapes shared across the boundary. */

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ErrorDetail {
  field?: string;
  issue: string;
}

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
    requestId: string;
    timestamp: string;
  };
}

/** `user` object returned by login / refresh / `GET /me`. */
export interface UserSummary {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  displayName: string;
  initials: string;
  avatarColor: string;
  doctorStatus: DoctorStatus | null;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: UserSummary;
}

export interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
  database: 'up' | 'down';
  version: string;
}
