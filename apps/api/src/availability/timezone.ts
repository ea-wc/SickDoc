/**
 * Timezone helpers for availability. Availability rules are authored as
 * minutes-from-midnight in the doctor's clinic timezone; slots are derived and
 * stored/served in UTC. These helpers convert between the two using the ICU
 * time-zone database built into Node (no external dependency).
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MINUTE = 60_000;

/** UTC offset (in ms) of `timeZone` at instant `utcMs` — i.e. wallUTC − utc. */
export function timezoneOffsetMs(timeZone: string, utcMs: number): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) % 24,
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - utcMs;
}

/** Converts a wall-clock `localDate` (YYYY-MM-DD) at `minuteOfDay` in `timeZone` to a UTC Date. */
export function wallTimeToUtc(timeZone: string, localDate: string, minuteOfDay: number): Date {
  const [year, month, day] = localDate.split('-').map(Number);
  const naive = Date.UTC(year, month - 1, day, 0, 0, 0) + minuteOfDay * MINUTE;
  return new Date(naive - timezoneOffsetMs(timeZone, naive));
}

/** Formats a UTC instant as a YYYY-MM-DD calendar date in `timeZone`. */
export function utcToLocalDateString(timeZone: string, d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Minute-of-day (0..1439) of a UTC instant in `timeZone`. */
export function utcToLocalMinuteOfDay(timeZone: string, d: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = dtf.formatToParts(d);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return (Number(map.hour) % 24) * 60 + Number(map.minute);
}

/** Calendar weekday (0=Sunday … 6=Saturday) for a YYYY-MM-DD string. */
export function weekdayOf(localDate: string): number {
  return new Date(`${localDate}T00:00:00.000Z`).getUTCDay();
}

/** Yields each local calendar date from `from` to `to` inclusive (YYYY-MM-DD). */
export function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const cursor = new Date(Date.UTC(fy, fm - 1, fd));
  const end = new Date(Date.UTC(ty, tm - 1, td));
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** Formats a Date as YYYY-MM-DD using its UTC calendar fields. */
export function dateOnlyString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isDateOnly(s: string): boolean {
  return DATE_RE.test(s);
}

/** Adds `days` to a Date and returns a new Date. */
export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
