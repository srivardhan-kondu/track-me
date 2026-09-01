/**
 * The shape of a workout while it is being logged.
 *
 * A live session is a different object from a finished one. A finished
 * workout is a record: every set in it happened. A live one is a worksheet —
 * it holds sets that have not been done yet, weights typed halfway, an
 * exercise added and then thought better of. This module describes that
 * worksheet, and it is deliberately free of database and network imports so
 * the same arithmetic runs in the athlete's thumb and on the server that
 * finally writes the row.
 *
 * Two rules the rest of the code depends on:
 *
 *   - Nothing counts until it is ticked. An unticked set contributes no
 *     volume, no set count, and is dropped entirely when the session ends.
 *   - Warm-ups are not work. They are logged, because the athlete wants to
 *     see what they warmed up with next time, but they never reach a total.
 */

import { toKg, type WeightUnit } from "./units";

export type SetKind = "WARMUP" | "WORKING" | "DROP" | "FAILURE";

/** Cycled by tapping the set number, in this order. */
export const SET_KINDS: SetKind[] = ["WORKING", "WARMUP", "DROP", "FAILURE"];

/** What goes in the set-number chip. Working sets are numbered, the rest lettered. */
export const SET_KIND_MARK: Record<SetKind, string> = {
  WORKING: "",
  WARMUP: "W",
  DROP: "D",
  FAILURE: "F",
};

export const SET_KIND_LABEL: Record<SetKind, string> = {
  WORKING: "Working set",
  WARMUP: "Warm-up",
  DROP: "Drop set",
  FAILURE: "To failure",
};

/** Weight and reps, or a held duration — a plank has no reps to give. */
export type TrackMode = "REPS" | "TIME";

export type DraftSet = {
  id: string;
  kind: SetKind;
  /**
   * Exactly as typed, in the unit named on the payload. Kept as a string so a
   * half-entered "6" on the way to "65" does not become a set at six kilos,
   * and converted to kilograms only when the session is finished.
   */
  weight: string;
  reps: string;
  /** Held duration in seconds, for a TIME exercise: what the face reads paused. */
  seconds: number;
  /**
   * Epoch milliseconds the stopwatch was last started, or null when it is
   * stopped. A wall-clock instant rather than a flag, so a plank keeps
   * counting while the phone is locked and the tab is asleep — which is
   * exactly when a plank is happening.
   */
  runningSince: number | null;
  done: boolean;
};

export type DraftExercise = {
  id: string;
  catalogId: string | null;
  name: string;
  notes: string;
  mode: TrackMode;
  /** Seconds to count down after a set is ticked. 0 means the timer is off. */
  rest: number;
  sets: DraftSet[];
};

export type DraftPayload = {
  version: 1;
  title: string;
  notes: string;
  /**
   * The unit every `weight` above is written in. Stored with the draft rather
   * than read from the profile at finish time: an athlete who switches to
   * pounds mid-session must not have the sixty they already logged silently
   * reread as sixty pounds.
   */
  unit: WeightUnit;
  exercises: DraftExercise[];
};

export const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 180, 300] as const;

export function emptyPayload(unit: WeightUnit): DraftPayload {
  return { version: 1, title: "", notes: "", unit, exercises: [] };
}

/** Ids only have to be unique within one draft, and never leave it. */
export function draftId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function newSet(from?: Partial<DraftSet>): DraftSet {
  return {
    id: draftId(),
    kind: "WORKING",
    weight: "",
    reps: "",
    seconds: 0,
    runningSince: null,
    done: false,
    ...from,
  };
}

export function newExercise(
  name: string,
  catalogId: string | null,
  mode: TrackMode = "REPS",
): DraftExercise {
  return {
    id: draftId(),
    catalogId,
    name,
    notes: "",
    mode,
    rest: 0,
    sets: [newSet()],
  };
}

/* -------------------------------------------------------------------------
   What a set is worth
   ------------------------------------------------------------------------- */

/** A warm-up is logged but never counted. Drops and failures are real work. */
export const countsAsWork = (kind: SetKind) => kind !== "WARMUP";

function num(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** A typed weight in kilograms, or null for bodyweight and for nonsense. */
export function setWeightKg(set: DraftSet, unit: WeightUnit): number | null {
  const n = num(set.weight);
  return n === null ? null : toKg(n, unit);
}

export function setReps(set: DraftSet): number | null {
  const n = num(set.reps);
  return n === null ? null : Math.round(n);
}

/**
 * Tonnage from one set: load times repetitions.
 *
 * A bodyweight set moves a real mass that this does not know, so it scores
 * nothing rather than guessing one — the same choice `tonnesLifted` has always
 * made, kept identical here so a live session and a dictated one agree.
 */
export function setVolumeKg(set: DraftSet, unit: WeightUnit): number {
  if (!set.done || !countsAsWork(set.kind)) return 0;
  const kg = setWeightKg(set, unit);
  const reps = setReps(set);
  if (kg === null || reps === null) return 0;
  return kg * reps;
}

export type DraftTotals = {
  /** Kilograms moved, over completed working sets. */
  volumeKg: number;
  /** Completed working sets. */
  sets: number;
  /** Completed sets of any kind, warm-ups included — what the ticks show. */
  ticked: number;
  /** Sets on screen, done or not. */
  planned: number;
};

export function draftTotals(payload: DraftPayload): DraftTotals {
  let volumeKg = 0;
  let sets = 0;
  let ticked = 0;
  let planned = 0;

  for (const exercise of payload.exercises) {
    for (const set of exercise.sets) {
      planned += 1;
      if (!set.done) continue;
      ticked += 1;
      if (!countsAsWork(set.kind)) continue;
      sets += 1;
      volumeKg += setVolumeKg(set, payload.unit);
    }
  }

  return { volumeKg, sets, ticked, planned };
}

/* -------------------------------------------------------------------------
   Dictated sessions
   ------------------------------------------------------------------------- */

/** A set on its way into the database, before it has an id. */
export type WritableSet = {
  position: number;
  kind: SetKind;
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
};

/**
 * The sets a dictated summary describes.
 *
 * "Four sets of eight at sixty" is not a vaguer way of saying something else —
 * it is a precise claim about four sets, each of eight reps at sixty kilos.
 * Storing it as one summary row was a limitation of the parser, not of what
 * the athlete said, so expanding it loses nothing and invents nothing: the
 * tonnage is identical either way, w x n x r being the same number as n
 * copies of w x r.
 *
 * A missing set count means one set, which is the same rule the muscle map
 * has always applied: an athlete who says "lat pulldown, seventeen and a half
 * for ten" described a set, and the parser recording no count did not make it
 * fewer than one. Only a missing rep count defeats this — "sixty kilos" with
 * no reps is a weight, not a set, and three rows reading "60" would assert
 * work nobody described.
 */
export function expandToSets(
  weightKg: number | null,
  sets: number | null,
  reps: number | null,
): WritableSet[] {
  if (reps === null || !Number.isFinite(reps)) return [];
  if (sets !== null && !Number.isFinite(sets)) return [];

  const count = sets === null ? 1 : Math.floor(sets);
  if (count < 1 || count > 50) return [];

  return Array.from({ length: count }, (_, position) => ({
    position,
    kind: "WORKING" as const,
    weightKg,
    reps: Math.round(reps),
    seconds: null,
  }));
}

/* -------------------------------------------------------------------------
   Last time
   ------------------------------------------------------------------------- */

/** One set as it was performed, read back out of a finished workout. */
export type PreviousSet = {
  kind: SetKind;
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
};

/**
 * The key a movement's history is remembered under: its catalog entry where
 * it resolved to one, its name where it did not. Lives here rather than
 * beside the query that fills the map, because the screen reading the map
 * runs in the browser and must not drag a database client along with it.
 */
export function movementKey(catalogId: string | null, name: string): string {
  return catalogId ? `id:${catalogId}` : `name:${name.trim().toLowerCase()}`;
}

/* -------------------------------------------------------------------------
   Clocks
   ------------------------------------------------------------------------- */

/**
 * A duration the way a gym reads one: seconds under a minute, then m:ss, then
 * h:mm:ss. Hours only appear once there are hours, so a normal session's
 * clock stays two fields wide and does not jump about as it ticks.
 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s}s`;

  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/**
 * What a timed set's face reads: the seconds it has banked, plus the ones it
 * is counting right now. Derived from wall-clock rather than accumulated by a
 * ticking interval, so a locked phone or a throttled background tab does not
 * cost the athlete part of their plank.
 */
export function elapsedSeconds(set: DraftSet, now: number): number {
  const running = set.runningSince
    ? Math.max(0, Math.floor((now - set.runningSince) / 1000))
    : 0;
  return set.seconds + running;
}

/** Banks a running stopwatch so the set can be saved or finished. */
export function stopStopwatch(set: DraftSet, now: number): DraftSet {
  if (!set.runningSince) return set;
  return { ...set, seconds: elapsedSeconds(set, now), runningSince: null };
}

/**
 * A finished session's length, spoken rather than ticked.
 *
 * The clock in the header counts, so it reads 1:02:00. A session that is over
 * is not counting any more and nobody cares about its seconds, so the summary
 * says "1h 2min" — which is also how the length of a workout is said out loud.
 */
export function formatLength(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}min`;
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

/** The stopwatch face on a timed set, which is always mm:ss. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

/** "1m 30s" — how a rest interval is named in a menu rather than shown ticking. */
export function formatRest(seconds: number): string {
  if (seconds <= 0) return "Off";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

/* -------------------------------------------------------------------------
   Reading a payload back
   ------------------------------------------------------------------------- */

/**
 * Coerces whatever came out of the Json column into a payload.
 *
 * The column is written by a client, so it is treated as untrusted shape
 * rather than as something the type says it is. Anything unrecognisable
 * becomes an empty session, which loses a draft but never renders a broken
 * screen or writes a bad workout.
 */
export function readPayload(value: unknown, fallbackUnit: WeightUnit): DraftPayload {
  const empty = emptyPayload(fallbackUnit);
  if (!value || typeof value !== "object") return empty;

  const raw = value as Record<string, unknown>;
  const exercises = Array.isArray(raw.exercises) ? raw.exercises : [];

  return {
    version: 1,
    title: typeof raw.title === "string" ? raw.title : "",
    notes: typeof raw.notes === "string" ? raw.notes : "",
    unit: raw.unit === "LB" ? "LB" : raw.unit === "KG" ? "KG" : fallbackUnit,
    exercises: exercises.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const ex = item as Record<string, unknown>;
      if (typeof ex.name !== "string" || !ex.name.trim()) return [];

      const sets = Array.isArray(ex.sets) ? ex.sets : [];

      return [
        {
          id: typeof ex.id === "string" ? ex.id : draftId(),
          catalogId: typeof ex.catalogId === "string" ? ex.catalogId : null,
          name: ex.name,
          notes: typeof ex.notes === "string" ? ex.notes : "",
          mode: ex.mode === "TIME" ? ("TIME" as const) : ("REPS" as const),
          rest: typeof ex.rest === "number" && ex.rest > 0 ? Math.floor(ex.rest) : 0,
          sets: sets.flatMap((s) => {
            if (!s || typeof s !== "object") return [];
            const set = s as Record<string, unknown>;
            return [
              {
                id: typeof set.id === "string" ? set.id : draftId(),
                kind: SET_KINDS.includes(set.kind as SetKind)
                  ? (set.kind as SetKind)
                  : ("WORKING" as const),
                weight: typeof set.weight === "string" ? set.weight : "",
                reps: typeof set.reps === "string" ? set.reps : "",
                seconds:
                  typeof set.seconds === "number" && set.seconds > 0
                    ? Math.floor(set.seconds)
                    : 0,
                runningSince:
                  typeof set.runningSince === "number" && set.runningSince > 0
                    ? set.runningSince
                    : null,
                done: set.done === true,
              },
            ];
          }),
        },
      ];
    }),
  };
}
