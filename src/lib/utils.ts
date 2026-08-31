import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Midnight UTC for the calendar day of `d` — the bucket used by WeightEntry.day. */
export function dayKey(d: Date | string = new Date()): Date {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

export function startOfDayLocal(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDayLocal(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Rounds to a sane number of digits for macro display. */
export function round(n: number | null | undefined, digits = 0): number | null {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function formatMacro(n: number | null | undefined, unit = "g"): string {
  const r = round(n);
  return r === null ? "—" : `${r}${unit}`;
}

/**
 * Tonnes moved in a session: weight × sets × reps, summed. Bodyweight and
 * part-filled entries contribute nothing rather than guessing a load.
 */
export function tonnesLifted(
  exercises: {
    weightKg: number | null;
    sets: number | null;
    reps: number | null;
  }[],
): number {
  const kg = exercises.reduce((total, ex) => {
    if (ex.weightKg === null || ex.sets === null || ex.reps === null) {
      return total;
    }
    return total + ex.weightKg * ex.sets * ex.reps;
  }, 0);

  return Math.round(kg) / 1000;
}

export function initials(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
