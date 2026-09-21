import type { AuthResponse, ErrorDetail, ErrorEnvelope, UserSummary } from "@sickdoc/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

/** Thrown for any non-2xx response; unwraps the API_SPEC §1 error envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: ErrorDetail[];

  constructor(message: string, status: number, code?: string, details?: ErrorDetail[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface Session {
  accessToken: string;
  user: UserSummary;
}

let session: Session | null = null;
let refreshPromise: Promise<Session | null> | null = null;
const listeners = new Set<(session: Session | null) => void>();

function notify(next: Session | null): void {
  for (const listener of listeners) listener(next);
}

export function getSession(): Session | null {
  return session;
}

/**
 * Sets (or clears) the in-memory session and mirrors the access token into a
 * non-httpOnly cookie so `middleware.ts` can route by role. The API remains
 * the source of truth — the cookie is only a routing hint.
 */
export function setSession(next: Session | null): void {
  session = next;
  if (typeof document !== "undefined") {
    if (next) {
      document.cookie = `accessToken=${next.accessToken}; path=/; samesite=lax; max-age=${60 * 60 * 24 * 7}`;
    } else {
      document.cookie = "accessToken=; path=/; max-age=0";
    }
  }
  notify(next);
}

export function onSessionChange(listener: (session: Session | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function refreshSession(): Promise<Session | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
        if (!response.ok) return null;
        const data = (await response.json()) as AuthResponse;
        return { accessToken: data.accessToken, user: data.user };
      } catch {
        return null;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Typed API client: base URL, bearer header, and a single silent refresh + retry
 * on a 401 before surfacing the unwrapped error envelope.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const request = (): Promise<Response> =>
    fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        ...(init.headers ?? {}),
      },
    });

  let response = await request();

  if (response.status === 401 && !path.startsWith("/auth/")) {
    const refreshed = await refreshSession();
    if (refreshed) {
      setSession(refreshed);
      response = await request();
    }
  }

  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as ErrorEnvelope | null;
    throw new ApiError(
      envelope?.error?.message ?? "Something went wrong. Please try again.",
      response.status,
      envelope?.error?.code,
      envelope?.error?.details,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export interface RegisterPatientInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  phone?: string;
}

export async function login(email: string, password: string): Promise<Session> {
  const data = await api<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  const next: Session = { accessToken: data.accessToken, user: data.user };
  setSession(next);
  return next;
}

export async function registerPatient(input: RegisterPatientInput): Promise<Session> {
  const data = await api<AuthResponse>("/auth/register/patient", { method: "POST", body: JSON.stringify(input) });
  const next: Session = { accessToken: data.accessToken, user: data.user };
  setSession(next);
  return next;
}

export async function registerDoctor(input: Record<string, unknown>): Promise<Session> {
  const data = await api<AuthResponse>("/auth/register/doctor", { method: "POST", body: JSON.stringify(input) });
  const next: Session = { accessToken: data.accessToken, user: data.user };
  setSession(next);
  return next;
}

export async function logout(): Promise<void> {
  try {
    await api<void>("/auth/logout", { method: "POST" });
  } finally {
    setSession(null);
  }
}

export async function restoreSession(): Promise<Session | null> {
  const refreshed = await refreshSession();
  if (refreshed) setSession(refreshed);
  return refreshed;
}
