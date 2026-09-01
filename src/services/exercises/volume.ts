import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { addDaysInZone, safeZone, startOfDayInZone } from "@/lib/tz";

/**
 * Training volume attributed to muscles.
 *
 * Sets are counted the way coaches count them: a set is worth 1 to each muscle
 * the exercise trains directly, and 0.5 to each muscle that meaningfully
 * assists. Stabilisers score nothing — bracing during a squat is not leg
 * training. An exercise that never resolved to the catalog contributes no
 * attribution, which is why unresolved sets are reported separately rather
 * than silently dropped.
 */

const SECONDARY_WEIGHT = 0.5;

export type GroupVolume = {
  groupId: string;
  key: string;
  name: string;
  /** Weighted sets: direct + 0.5 x assisting. */
  sets: number;
  /** Sets where this group did the work. */
  directSets: number;
  exercises: string[];
};

export type MuscleVolume = {
  muscleId: string;
  name: string;
  groupName: string;
  sets: number;
};

export type VolumeReport = {
  from: Date;
  to: Date;
  groups: GroupVolume[];
  muscles: MuscleVolume[];
  totalSets: number;
  /** Sets logged against an exercise the catalog does not know. */
  unattributedSets: number;
  patterns: { pattern: string; sets: number }[];
};

/** Everything the attribution needs to know about one logged exercise. */
const attributionSelect = {
  name: true,
  sets: true,
  catalog: {
    select: {
      name: true,
      pattern: true,
      muscles: {
        select: {
          role: true,
          muscle: {
            select: {
              id: true,
              name: true,
              group: {
                select: { id: true, key: true, name: true, position: true },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ExerciseSelect;

type AttributedExercise = Prisma.ExerciseGetPayload<{
  select: typeof attributionSelect;
}>;

/** Sets a week, or sets in one session — the same arithmetic either way. */
function attribute(
  exercises: AttributedExercise[],
): Omit<VolumeReport, "from" | "to"> {
  const groups = new Map<string, GroupVolume & { position: number }>();
  const muscles = new Map<string, MuscleVolume>();
  const patterns = new Map<string, number>();

  let totalSets = 0;
  let unattributedSets = 0;

  for (const ex of exercises) {
    // A logged exercise with no set count still represents one working set.
    const setCount = ex.sets ?? 1;
    totalSets += setCount;

    if (!ex.catalog) {
      unattributedSets += setCount;
      continue;
    }

    patterns.set(
      ex.catalog.pattern,
      (patterns.get(ex.catalog.pattern) ?? 0) + setCount,
    );

    // A group scores once per exercise at its strongest role, so an exercise
    // listing four quad heads does not count as four times the leg volume.
    const groupRole = new Map<string, "PRIMARY" | "SECONDARY">();

    for (const link of ex.catalog.muscles) {
      if (link.role === "STABILISER") continue;

      const g = link.muscle.group;
      const existing = groupRole.get(g.id);
      if (!existing || (existing === "SECONDARY" && link.role === "PRIMARY")) {
        groupRole.set(g.id, link.role);
      }

      const weight = link.role === "PRIMARY" ? 1 : SECONDARY_WEIGHT;
      const m = muscles.get(link.muscle.id) ?? {
        muscleId: link.muscle.id,
        name: link.muscle.name,
        groupName: g.name,
        sets: 0,
      };
      m.sets += setCount * weight;
      muscles.set(link.muscle.id, m);

      if (!groups.has(g.id)) {
        groups.set(g.id, {
          groupId: g.id,
          key: g.key,
          name: g.name,
          sets: 0,
          directSets: 0,
          exercises: [],
          position: g.position,
        });
      }
    }

    for (const [groupId, role] of groupRole) {
      const entry = groups.get(groupId);
      if (!entry) continue;
      entry.sets += setCount * (role === "PRIMARY" ? 1 : SECONDARY_WEIGHT);
      if (role === "PRIMARY") entry.directSets += setCount;
      if (!entry.exercises.includes(ex.catalog.name)) {
        entry.exercises.push(ex.catalog.name);
      }
    }
  }

  const round1 = (n: number) => Math.round(n * 10) / 10;

  return {
    groups: [...groups.values()]
      .sort((a, b) => b.sets - a.sets || a.position - b.position)
      .map(({ position: _position, ...g }) => ({ ...g, sets: round1(g.sets) })),
    muscles: [...muscles.values()]
      .sort((a, b) => b.sets - a.sets)
      .map((m) => ({ ...m, sets: round1(m.sets) })),
    totalSets,
    unattributedSets,
    patterns: [...patterns.entries()]
      .map(([pattern, sets]) => ({ pattern, sets }))
      .sort((a, b) => b.sets - a.sets),
  };
}

/** What an athlete trained over the last `days`, in their own time zone. */
export async function getMuscleVolume(
  userId: string,
  days = 7,
  timeZone = "UTC",
): Promise<VolumeReport> {
  const zone = safeZone(timeZone);
  const now = new Date();
  const from = startOfDayInZone(addDaysInZone(now, -(days - 1), zone), zone);

  const exercises = await db.exercise.findMany({
    where: { workout: { userId, performedAt: { gte: from, lte: now } } },
    select: attributionSelect,
  });

  return { from, to: now, ...attribute(exercises) };
}

/**
 * What one session trained — the map on the screen that comes up the moment
 * an athlete presses Finish.
 */
export async function getWorkoutMuscleVolume(
  workoutId: string,
): Promise<Omit<VolumeReport, "from" | "to">> {
  const exercises = await db.exercise.findMany({
    where: { workoutId },
    select: attributionSelect,
  });

  return attribute(exercises);
}

/**
 * Push-to-pull balance, the imbalance a coach checks first. Returns null when
 * there is not enough attributed work to say anything meaningful.
 */
export function pushPullBalance(
  patterns: { pattern: string; sets: number }[],
): { push: number; pull: number; ratio: number } | null {
  const push = patterns
    .filter((p) => p.pattern === "HORIZONTAL_PUSH" || p.pattern === "VERTICAL_PUSH")
    .reduce((a, p) => a + p.sets, 0);
  const pull = patterns
    .filter((p) => p.pattern === "HORIZONTAL_PULL" || p.pattern === "VERTICAL_PULL")
    .reduce((a, p) => a + p.sets, 0);

  if (push + pull < 4) return null;
  return { push, pull, ratio: pull === 0 ? Infinity : push / pull };
}
