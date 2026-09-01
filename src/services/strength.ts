import { db } from "@/lib/db";

/**
 * Strength progression and personal records.
 *
 * A record is set by one set, so this reads sets rather than sessions.
 *
 * Where they exist, that means the real set rows: a session logged live at
 * 50x8, 60x6 and 65x4 offers three candidate records, and the heaviest is not
 * always the best one — 60x6 estimates a higher one-rep max than 65x4 does. A
 * dictated exercise has only its summary, "four sets of eight at sixty",
 * which is one candidate repeated, so it contributes that.
 */

/**
 * Epley's estimate of a one-rep max: w x (1 + r/30).
 *
 * Chosen over Brzycki because it degrades more gracefully at high reps, though
 * both drift badly past about twelve — see RELIABLE_REPS.
 */
export function estimated1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/**
 * Beyond this many reps a one-rep max estimate says more about endurance than
 * strength, so the UI marks those records rather than presenting them flatly.
 */
export const RELIABLE_REPS = 12;

export type PersonalRecord = {
  exercise: string;
  /** Heaviest weight moved for any number of reps. */
  heaviestKg: number;
  heaviestReps: number;
  /** Best estimated one-rep max, and the set that produced it. */
  bestE1RM: number;
  bestSetKg: number;
  bestSetReps: number;
  achievedAt: Date;
  /** Sessions this movement appears in — how much to trust the trend. */
  sessions: number;
  /** True when the best estimate came from a set long enough to be shaky. */
  estimateIsSoft: boolean;
};

type Row = {
  name: string;
  weightKg: number | null;
  reps: number | null;
  workout: { performedAt: Date };
};

async function loadSets(userId: string, days?: number): Promise<Row[]> {
  const from = days
    ? new Date(Date.now() - days * 86_400_000)
    : undefined;

  const exercises = await db.exercise.findMany({
    where: {
      workout: {
        userId,
        status: "COMPLETE",
        ...(from ? { performedAt: { gte: from } } : {}),
      },
      weightKg: { gt: 0 },
      reps: { gt: 0 },
    },
    select: {
      name: true,
      weightKg: true,
      reps: true,
      workout: { select: { performedAt: true } },
      setLog: { select: { kind: true, weightKg: true, reps: true } },
    },
    orderBy: { workout: { performedAt: "asc" } },
  });

  return exercises.flatMap((ex) => {
    if (ex.setLog.length === 0) {
      return [{ name: ex.name, weightKg: ex.weightKg, reps: ex.reps, workout: ex.workout }];
    }

    // A warm-up is not a record attempt, whatever the bar said.
    return ex.setLog
      .filter((s) => s.kind !== "WARMUP" && s.weightKg && s.reps)
      .map((s) => ({
        name: ex.name,
        weightKg: s.weightKg,
        reps: s.reps,
        workout: ex.workout,
      }));
  });
}

/** Normalises "Bench Press" and "bench press" onto one record. */
function key(name: string): string {
  return name.trim().toLowerCase();
}

function titleCase(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** The best set ever performed of each movement, heaviest first. */
export async function getPersonalRecords(
  userId: string,
  days?: number,
): Promise<PersonalRecord[]> {
  const rows = await loadSets(userId, days);
  const byExercise = new Map<string, PersonalRecord>();

  for (const row of rows) {
    const weight = row.weightKg!;
    const reps = row.reps!;
    const e1rm = estimated1RM(weight, reps);
    const k = key(row.name);
    const existing = byExercise.get(k);

    if (!existing) {
      byExercise.set(k, {
        exercise: titleCase(row.name),
        heaviestKg: weight,
        heaviestReps: reps,
        bestE1RM: e1rm,
        bestSetKg: weight,
        bestSetReps: reps,
        achievedAt: row.workout.performedAt,
        sessions: 1,
        estimateIsSoft: reps > RELIABLE_REPS,
      });
      continue;
    }

    existing.sessions += 1;

    if (weight > existing.heaviestKg) {
      existing.heaviestKg = weight;
      existing.heaviestReps = reps;
    }

    if (e1rm > existing.bestE1RM) {
      existing.bestE1RM = e1rm;
      existing.bestSetKg = weight;
      existing.bestSetReps = reps;
      existing.achievedAt = row.workout.performedAt;
      existing.estimateIsSoft = reps > RELIABLE_REPS;
    }
  }

  return [...byExercise.values()].sort((a, b) => b.bestE1RM - a.bestE1RM);
}

export type ProgressionPoint = { at: Date; e1rm: number };

export type Progression = {
  exercise: string;
  points: ProgressionPoint[];
  /** Change in estimated one-rep max from first session to last, in kg. */
  changeKg: number;
};

/**
 * Estimated one-rep max over time, for the movements trained most often.
 *
 * One point per session — the best set of that session — because plotting
 * every set turns a progression into noise.
 */
export async function getProgression(
  userId: string,
  days: number,
  limit = 4,
): Promise<Progression[]> {
  const rows = await loadSets(userId, days);

  // exercise -> session day -> best e1RM that day
  const byExercise = new Map<string, Map<number, ProgressionPoint>>();

  for (const row of rows) {
    const k = key(row.name);
    const at = row.workout.performedAt;
    const day = new Date(at).setHours(0, 0, 0, 0);
    const e1rm = estimated1RM(row.weightKg!, row.reps!);

    let sessions = byExercise.get(k);
    if (!sessions) {
      sessions = new Map();
      byExercise.set(k, sessions);
    }

    const best = sessions.get(day);
    if (!best || e1rm > best.e1rm) sessions.set(day, { at, e1rm });
  }

  return [...byExercise.entries()]
    .map(([k, sessions]) => {
      const points = [...sessions.values()].sort(
        (a, b) => a.at.getTime() - b.at.getTime(),
      );
      return {
        exercise: titleCase(k),
        points,
        changeKg:
          points.length > 1
            ? Math.round((points[points.length - 1].e1rm - points[0].e1rm) * 10) / 10
            : 0,
      };
    })
    // Two sessions is the fewest that can show a direction.
    .filter((p) => p.points.length > 1)
    .sort((a, b) => b.points.length - a.points.length)
    .slice(0, limit);
}
