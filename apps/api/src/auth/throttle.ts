import type { ThrottlerGetTrackerFunction } from '@nestjs/throttler';

/**
 * Keys auth attempts by client IP plus the submitted email, so a single IP
 * cannot brute-force many accounts and a single account cannot be brute-forced
 * from many IPs within the same window (10 attempts / 15 min).
 */
export const authThrottleTracker: ThrottlerGetTrackerFunction = (req) => {
  const ip = Array.isArray(req.ips) && req.ips.length > 0 ? req.ips[0] : req.ip;
  const body = req?.body as { email?: unknown } | undefined;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  return email ? `${String(ip)}:${email}` : String(ip ?? 'unknown');
};

/** Per-route throttle options for the auth controller. */
export const AUTH_THROTTLE = {
  default: { limit: 10, ttl: 15 * 60 * 1000, getTracker: authThrottleTracker },
};
