/**
 * Timezone-aware date helpers.
 *
 * Server Components format and bucket dates on the server, whose own zone is
 * UTC in production. Without an explicit zone an athlete in IST sees times
 * shifted by 5h30m, and anything they log between midnight and 05:30 local
 * lands on the previous day's timeline. Every date decision therefore takes
 * the athlete's IANA zone explicitly.
 */

export const DEFAULT_TIME_ZONE = "UTC";

/** Guards against a bad or unknown zone reaching Intl and throwing. */
export function safeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function partsInZone(date: Date, timeZone: string): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = p.value;
  }

  return {
    year: Number(out.year),
    month: Number(out.month),
    // Intl renders midnight as hour 24 in some locales/zones.
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
  };
}

/** Milliseconds the zone is ahead of UTC at this instant. */
function offsetMs(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  // Carry the milliseconds through: Intl does not report them, and omitting
  // them here leaves the sub-second remainder in the computed offset.
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
    date.getUTCMilliseconds(),
  );
  return asUtc - date.getTime();
}

/** The instant at which the given wall-clock time occurs in `timeZone`. */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  // Resolve the offset at the approximate instant, then correct for it.
  const offset = offsetMs(new Date(guess), timeZone);
  return new Date(guess - offset);
}

/** Midnight, in the athlete's zone, of the day `date` falls on. */
export function startOfDayInZone(date: Date, timeZone: string): Date {
  const p = partsInZone(date, timeZone);
  return zonedTimeToUtc(p.year, p.month, p.day, timeZone);
}

/** The last millisecond of that same local day. */
export function endOfDayInZone(date: Date, timeZone: string): Date {
  const p = partsInZone(date, timeZone);
  return zonedTimeToUtc(p.year, p.month, p.day, timeZone, 23, 59, 59, 999);
}

/**
 * The date-only bucket used by WeightEntry.day, as midnight UTC of the
 * athlete's local calendar date.
 */
export function dayKeyInZone(date: Date, timeZone: string): Date {
  const p = partsInZone(date, timeZone);
  return new Date(Date.UTC(p.year, p.month - 1, p.day));
}

/** Adds whole days in local terms, so DST shifts do not drift the time. */
export function addDaysInZone(date: Date, days: number, timeZone: string): Date {
  const p = partsInZone(date, timeZone);
  return zonedTimeToUtc(p.year, p.month, p.day + days, timeZone, p.hour, p.minute, p.second);
}

/** True when both instants fall on the same local calendar day. */
export function isSameDayInZone(a: Date, b: Date, timeZone: string): boolean {
  return startOfDayInZone(a, timeZone).getTime() === startOfDayInZone(b, timeZone).getTime();
}

/** `YYYY-MM-DD` for the local calendar date — used for ?date= links. */
export function toDateParam(date: Date, timeZone: string): string {
  const p = partsInZone(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Parses a `YYYY-MM-DD` param as midday local, avoiding boundary ambiguity. */
export function fromDateParam(value: string | undefined, timeZone: string): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
  const [y, m, d] = value.split("-").map(Number);
  const at = zonedTimeToUtc(y, m, d, timeZone, 12);
  return Number.isNaN(at.getTime()) ? new Date() : at;
}

export function formatTimeInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDateInZone(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" },
): string {
  return new Intl.DateTimeFormat(undefined, { timeZone, ...options }).format(date);
}
