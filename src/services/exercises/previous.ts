import { db } from "@/lib/db";
import { movementKey, type PreviousSet, type SetKind } from "@/lib/live-session";

/**
 * What the athlete did last time.
 *
 * This is the column that makes logging worth doing. Nobody remembers what
 * they rowed a week ago, and the number they half-remember is generous; put
 * last session's sets beside today's empty boxes and the next weight chooses
 * itself. It is also the only progressive-overload cue the app can give
 * without asking the athlete a single question.
 *
 * A movement is matched by its catalog entry first and by its name second, so
 * "T Bar Row" picked from the catalog lines up with the same movement logged
 * by voice a fortnight ago.
 */

export type PreviousEntry = {
  performedAt: Date;
  /** The set log if the session was logged live, else the dictated summary. */
  sets: PreviousSet[];
};

/**
 * The most recent performance of each of `movements`, keyed by `movementKey`.
 *
 * Movements the athlete has never logged are simply absent, which the column
 * renders as a dash rather than as a zero — "no previous" and "nothing lifted"
 * are different facts.
 */
export async function lastPerformances(
  userId: string,
  movements: { catalogId: string | null; name: string }[],
): Promise<Map<string, PreviousEntry>> {
  const found = new Map<string, PreviousEntry>();
  if (movements.length === 0) return found;

  const catalogIds = [
    ...new Set(movements.map((m) => m.catalogId).filter((id): id is string => !!id)),
  ];
  const names = [...new Set(movements.map((m) => m.name.trim()).filter(Boolean))];

  const rows = await db.exercise.findMany({
    where: {
      workout: { userId, status: "COMPLETE" },
      OR: [
        ...(catalogIds.length ? [{ catalogId: { in: catalogIds } }] : []),
        ...(names.length ? [{ name: { in: names } }] : []),
      ],
    },
    select: {
      name: true,
      catalogId: true,
      weightKg: true,
      sets: true,
      reps: true,
      workoutId: true,
      workout: { select: { performedAt: true } },
      setLog: {
        orderBy: { position: "asc" },
        select: { kind: true, weightKg: true, reps: true, seconds: true },
      },
    },
    // Newest session first, and within it the order the movements were done.
    orderBy: [{ workout: { performedAt: "desc" } }, { position: "asc" }],
    // A ceiling rather than a page: one screen asks about a handful of
    // movements, and this stops a long history turning into a long query.
    take: 300,
  });

  // Which session each movement's history was taken from, so rows the parser
  // split across several exercise rows are gathered back up — but only within
  // that one session, never smeared across two.
  const source = new Map<string, string>();

  for (const row of rows) {
    // A row resolved to the catalog answers for both keys, so a movement
    // typed by hand today still finds the session it was picked for last week.
    const keys = new Set([movementKey(row.catalogId, row.name)]);
    if (row.catalogId) keys.add(movementKey(null, row.name));

    const sets: PreviousSet[] =
      row.setLog.length > 0
        ? row.setLog.map((s) => ({
            kind: s.kind as SetKind,
            weightKg: s.weightKg,
            reps: s.reps,
            seconds: s.seconds,
          }))
        : // A summary with no set log still describes sets, and no set count
          // still means one — the same reading `expandToSets` and the muscle
          // map both take.
          Array.from({ length: Math.max(1, row.sets ?? 1) }, () => ({
            kind: "WORKING" as const,
            weightKg: row.weightKg,
            reps: row.reps,
            seconds: null,
          }));

    for (const key of keys) {
      const from = source.get(key);

      // A later session already answered for this movement.
      if (from !== undefined && from !== row.workoutId) continue;

      if (from === undefined) {
        source.set(key, row.workoutId);
        found.set(key, { performedAt: row.workout.performedAt, sets: [...sets] });
        continue;
      }

      found.get(key)!.sets.push(...sets);
    }
  }

  return found;
}
