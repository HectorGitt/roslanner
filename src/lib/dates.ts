/**
 * Calendar-date helpers.
 *
 * A roster day, a holiday and a leave day are calendar dates, not instants:
 * "26 December" must mean the same day whether the server runs in Lagos or on a
 * host set to UTC. So every such date is stored and compared as **UTC
 * midnight**, and all day arithmetic here uses UTC components. Mixing in
 * local-time parsing (`new Date("2027-12-26T00:00:00")`) shifts the value by the
 * host's offset and silently moves dates across day boundaries.
 */

/** Parse a `yyyy-mm-dd` string to UTC midnight. */
export function parseISODate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

/** Format a date as `yyyy-mm-dd` from its UTC components. */
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** UTC midnight of the calendar day this date falls on. */
export function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** UTC midnight `n` days after `d` (n may be negative). */
export function addDays(d: Date, n: number): Date {
  return new Date(startOfDay(d).getTime() + n * 86_400_000);
}

/** Whole days from `from` to `to`, ignoring time of day. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

/** Day of week, 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(d: Date): number {
  return startOfDay(d).getUTCDay();
}
