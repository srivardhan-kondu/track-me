/**
 * Putting a movement's sets back together.
 *
 * The voice parser records what it hears, and an athlete dictating a session
 * set by set — "t-bar row, fifteen for fifteen; then twenty-five for thirteen,
 * twice; then thirty for ten, three times" — produces three separate exercise
 * rows for one movement. Stored that way it is faithful; shown that way it is
 * nonsense: three T-Bar Row headings in a row, and a session of five movements
 * announcing itself as fifteen exercises.
 *
 * So the rows are regrouped for display. Only *consecutive* rows of the same
 * movement merge, which is the difference between reassembling one exercise
 * the parser split and silently welding together a movement the athlete
 * genuinely came back to at the end of the session.
 *
 * Kept free of database imports so the timeline, the session card and the
 * finish screen all read a session the same way on either side of the client
 * boundary.
 */

export type ViewSet = {
  id: string;
  kind: string;
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
};

export type ViewExercise = {
  id: string;
  name: string;
  weightKg: number | null;
  sets: number | null;
  reps: number | null;
  setLog: ViewSet[];
};

export type ExerciseGroup = {
  /** Stable across renders: the first row's id. */
  id: string;
  name: string;
  /** Every set of the movement, in the order it was performed. */
  sets: ViewSet[];
  /** Working sets — warm-ups are shown but never counted. */
  workingSets: number;
  /** Heaviest load across the movement, for the line beside the name. */
  topKg: number | null;
};

/** "T-Bar Row" and "t bar row" are one movement. */
function key(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * The sets a row represents.
 *
 * A row written since set-by-set logging has its own; an older one is read
 * off its summary, where no set count still means one set. A row with a
 * weight but no reps yields a set with no reps rather than nothing, because
 * "seated cable row, twenty-five kilos" did happen and dropping it would
 * leave a movement showing no sets at all.
 */
function setsOf(exercise: ViewExercise): ViewSet[] {
  if (exercise.setLog.length > 0) return exercise.setLog;

  const count = Math.min(50, Math.max(1, exercise.sets ?? 1));
  return Array.from({ length: count }, (_, i) => ({
    id: `${exercise.id}-${i}`,
    kind: "WORKING",
    weightKg: exercise.weightKg,
    reps: exercise.reps,
    seconds: null,
  }));
}

/** One movement of a parsed session, ready to be written as a single row. */
export type MergedExercise = {
  name: string;
  /** The heaviest working set — what the summary columns describe. */
  weightKg: number | null;
  sets: number | null;
  reps: number | null;
  setLog: {
    position: number;
    kind: "WORKING";
    weightKg: number | null;
    reps: number | null;
    seconds: null;
  }[];
};

/**
 * Folds a parsed session's consecutive mentions of one movement into a single
 * exercise carrying all of its sets.
 *
 * The parser is given speech and returns what it hears, so "t-bar row,
 * twenty-five for thirteen, twice; then thirty for ten, three times" comes
 * back as two exercises. Both are the same movement, and the athlete did five
 * sets of it. Merging them is the difference between a session that reads as
 * five movements and one that reads as fifteen.
 *
 * Summary columns follow the same convention a live session uses: the count
 * of working sets, and the load and reps of the heaviest one.
 */
export function mergeDictated(
  parsed: { name: string; weightKg: number | null; sets: number | null; reps: number | null }[],
  expand: (
    weightKg: number | null,
    sets: number | null,
    reps: number | null,
  ) => { position: number; weightKg: number | null; reps: number | null }[],
): MergedExercise[] {
  const merged: MergedExercise[] = [];

  for (const exercise of parsed) {
    const last = merged[merged.length - 1];
    const target =
      last && key(last.name) === key(exercise.name)
        ? last
        : (merged.push({
            name: exercise.name,
            weightKg: null,
            sets: null,
            reps: null,
            setLog: [],
          }),
          merged[merged.length - 1]);

    for (const set of expand(exercise.weightKg, exercise.sets, exercise.reps)) {
      target.setLog.push({
        position: target.setLog.length,
        kind: "WORKING",
        weightKg: set.weightKg,
        reps: set.reps,
        seconds: null,
      });
    }

    // A mention the expansion could not turn into sets — a weight with no
    // reps — still tells us the movement happened, so its load is kept for
    // the summary even though it contributes no set row and no tonnage.
    const load = exercise.weightKg;
    if (
      load !== null &&
      (target.weightKg === null ||
        load > target.weightKg ||
        (load === target.weightKg && (exercise.reps ?? 0) > (target.reps ?? 0)))
    ) {
      target.weightKg = load;
      target.reps = exercise.reps;
    }
  }

  for (const exercise of merged) {
    exercise.sets = exercise.setLog.length > 0 ? exercise.setLog.length : null;
  }

  return merged;
}

export function groupExercises(exercises: ViewExercise[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];

  for (const exercise of exercises) {
    const sets = setsOf(exercise);
    const last = groups[groups.length - 1];

    const group =
      last && key(last.name) === key(exercise.name)
        ? last
        : (groups.push({
            id: exercise.id,
            name: exercise.name,
            sets: [],
            workingSets: 0,
            topKg: null,
          }),
          groups[groups.length - 1]);

    for (const set of sets) {
      group.sets.push(set);
      if (set.kind === "WARMUP") continue;
      group.workingSets += 1;
      if (set.weightKg !== null && (group.topKg === null || set.weightKg > group.topKg)) {
        group.topKg = set.weightKg;
      }
    }
  }

  return groups;
}
