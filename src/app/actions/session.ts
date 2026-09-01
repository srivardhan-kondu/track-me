"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  countsAsWork,
  readPayload,
  setReps,
  setWeightKg,
  type DraftExercise,
  type DraftPayload,
  type PreviousSet,
} from "@/lib/live-session";
import { requireUser } from "@/lib/session";
import { lastPerformances } from "@/services/exercises/previous";
import { resolveExerciseIds } from "@/services/exercises/resolve";
import { getUnits } from "@/services/units";

import type { ActionResult } from "./meals";

/**
 * Server side of the live workout logger.
 *
 * The draft is written to the server rather than kept in the tab because a
 * session lasts ninety minutes on a phone that locks, gets bumped out of
 * memory, and is sometimes swapped for a tablet mid-workout. Losing an hour
 * of logged sets to a browser reclaiming a background tab is the one failure
 * this feature cannot have.
 *
 * Nothing here writes a Workout until `finishSession`. Up to that point a
 * session does not exist as far as the rest of the app is concerned.
 */

/** A ceiling on what one session may hold, so a stuck client cannot grow it forever. */
const MAX_EXERCISES = 60;
const MAX_SETS_PER_EXERCISE = 40;

/** Above this a "session" is a tab left open overnight, not a workout. */
const MAX_SESSION_MINUTES = 600;

function trimPayload(payload: DraftPayload): DraftPayload {
  return {
    ...payload,
    title: payload.title.slice(0, 120),
    notes: payload.notes.slice(0, 1000),
    exercises: payload.exercises.slice(0, MAX_EXERCISES).map((ex) => ({
      ...ex,
      name: ex.name.slice(0, 120),
      notes: ex.notes.slice(0, 500),
      sets: ex.sets.slice(0, MAX_SETS_PER_EXERCISE).map((s) => ({
        ...s,
        // Long enough for "137.5", short enough that nothing else fits.
        weight: s.weight.slice(0, 8),
        reps: s.reps.slice(0, 4),
      })),
    })),
  };
}

export type SessionDraft = {
  startedAt: string;
  payload: DraftPayload;
};

/**
 * Opens a session, or hands back the one already open.
 *
 * Starting a second workout while one is unfinished resumes the first. It is
 * the only behaviour that cannot lose work, and an athlete who genuinely
 * wants a clean slate has Discard.
 */
export async function startSession(): Promise<
  { ok: true; draft: SessionDraft } | { ok: false; error: string }
> {
  const user = await requireUser();
  const units = await getUnits(user.id);

  const existing = await db.workoutDraft.findUnique({
    where: { userId: user.id },
    select: { startedAt: true, payload: true },
  });

  if (existing) {
    return {
      ok: true,
      draft: {
        startedAt: existing.startedAt.toISOString(),
        payload: readPayload(existing.payload, units.weight),
      },
    };
  }

  const payload: DraftPayload = {
    version: 1,
    title: "",
    notes: "",
    unit: units.weight,
    exercises: [],
  };

  const draft = await db.workoutDraft.create({
    data: { userId: user.id, payload },
    select: { startedAt: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workouts");

  return {
    ok: true,
    draft: { startedAt: draft.startedAt.toISOString(), payload },
  };
}

/**
 * Autosave. Called on a debounce as the athlete types, so it is deliberately
 * one upsert and nothing else — no revalidation, no reads, nothing that would
 * make a keystroke expensive.
 */
export async function saveSession(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  // No unit lookup here: the payload carries the unit it was written in, and
  // this runs on a debounce behind every keystroke.
  const payload = trimPayload(readPayload(input, "KG"));

  await db.workoutDraft.upsert({
    where: { userId: user.id },
    create: { userId: user.id, payload },
    update: { payload },
  });

  return { ok: true };
}

/**
 * Last session's sets for a handful of movements, for the PREVIOUS column.
 *
 * The page loads history for whatever the draft already holds; this fills in
 * the ones added mid-session, one round trip per exercise picked.
 */
export async function lookupPrevious(
  input: unknown,
): Promise<Record<string, PreviousSet[]>> {
  const user = await requireUser();

  const movements = Array.isArray(input)
    ? input.flatMap((m) => {
        if (!m || typeof m !== "object") return [];
        const row = m as Record<string, unknown>;
        if (typeof row.name !== "string" || !row.name.trim()) return [];
        return [
          {
            catalogId: typeof row.catalogId === "string" ? row.catalogId : null,
            name: row.name,
          },
        ];
      })
    : [];

  if (movements.length === 0) return {};

  const found = await lastPerformances(user.id, movements.slice(0, MAX_EXERCISES));
  return Object.fromEntries([...found].map(([key, entry]) => [key, entry.sets]));
}

export async function discardSession(): Promise<ActionResult> {
  const user = await requireUser();

  await db.workoutDraft.deleteMany({ where: { userId: user.id } });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workouts");
  return { ok: true };
}

/**
 * What survives a set-by-set exercise into the summary columns every older
 * reader still uses.
 *
 * `sets` is the count of working sets, which is what the muscle map counts.
 * `weightKg`/`reps` describe the heaviest working set, which is what the
 * personal records read — ties broken toward more reps, since 80 x 8 is the
 * better set than 80 x 5.
 */
function summarise(exercise: DraftExercise, unit: DraftPayload["unit"]) {
  let sets = 0;
  let weightKg: number | null = null;
  let reps: number | null = null;

  for (const set of exercise.sets) {
    if (!set.done || !countsAsWork(set.kind)) continue;
    sets += 1;

    const kg = setWeightKg(set, unit);
    const r = setReps(set);
    if (kg === null) continue;

    if (weightKg === null || kg > weightKg || (kg === weightKg && (r ?? 0) > (reps ?? 0))) {
      weightKg = kg;
      reps = r;
    }
  }

  return { sets, weightKg, reps };
}

/**
 * Turns the worksheet into a record.
 *
 * Only ticked sets are written. A set the athlete added and never completed
 * was a plan; keeping it would mean the log said they did work they did not
 * do, which is worse than losing the row.
 */
export async function finishSession(
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  const units = await getUnits(user.id);

  const draft = await db.workoutDraft.findUnique({
    where: { userId: user.id },
    select: { startedAt: true },
  });
  if (!draft) {
    return { ok: false, error: "This session has already been finished." };
  }

  const payload = trimPayload(readPayload(input, units.weight));

  const performed = payload.exercises
    .map((ex) => ({ ex, done: ex.sets.filter((s) => s.done) }))
    .filter((e) => e.done.length > 0);

  if (performed.length === 0) {
    return {
      ok: false,
      error: "Tick off at least one set, or discard the session.",
    };
  }

  const catalogIds = await resolveExerciseIds(performed.map((e) => e.ex.name));

  const elapsedMin = Math.round(
    (Date.now() - draft.startedAt.getTime()) / 60_000,
  );
  const durationMin = Math.min(Math.max(elapsedMin, 1), MAX_SESSION_MINUTES);

  const workout = await db.workout.create({
    data: {
      userId: user.id,
      title: payload.title.trim() || "Workout",
      notes: payload.notes.trim() || null,
      durationMin,
      // The session is dated when it started, not when Finish was pressed —
      // a workout begun at 6:12 belongs to 6:12 even if it ran past midnight.
      performedAt: draft.startedAt,
      status: "COMPLETE",
      aiGenerated: false,
      exercises: {
        create: performed.map(({ ex, done }, i) => ({
          name: ex.name,
          position: i,
          catalogId: ex.catalogId ?? catalogIds[i],
          ...summarise({ ...ex, sets: done }, payload.unit),
          setLog: {
            create: done.map((set, position) => ({
              position,
              kind: set.kind,
              weightKg: ex.mode === "TIME" ? null : setWeightKg(set, payload.unit),
              reps: ex.mode === "TIME" ? null : setReps(set),
              seconds: ex.mode === "TIME" ? set.seconds || null : null,
            })),
          },
        })),
      },
    },
    select: { id: true },
  });

  await db.workoutDraft.deleteMany({ where: { userId: user.id } });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workouts");
  revalidatePath("/dashboard/strength");

  return { ok: true, id: workout.id };
}
