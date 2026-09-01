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
 * Tonnes moved in a session. Bodyweight and part-filled entries contribute
 * nothing rather than guessing a load.
 *
 * A session logged set by set is added up set by set — 50x8 then 60x6 then
 * 65x4 is 1,020 kg, and no single weight-times-sets-times-reps sum of those
 * three rows gets near it. A dictated session has only the summary columns to
 * work from, so it falls back to exactly the arithmetic it always used.
 *
 * Warm-ups are excluded on both paths: a live session never writes them as
 * working sets, and a dictated one never had them to begin with.
 */
export function tonnesLifted(
  exercises: {
    weightKg: number | null;
    sets: number | null;
    reps: number | null;
    setLog?: { kind: string; weightKg: number | null; reps: number | null }[];
  }[],
): number {
  const kg = exercises.reduce((total, ex) => {
    if (ex.setLog && ex.setLog.length > 0) {
      return (
        total +
        ex.setLog.reduce((sum, set) => {
          if (set.kind === "WARMUP" || set.weightKg === null || set.reps === null) {
            return sum;
          }
          return sum + set.weightKg * set.reps;
        }, 0)
      );
    }

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
