"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { expandToSets } from "@/lib/live-session";
import { enforce, RateLimited } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { readUpload } from "@/lib/uploads";
import { runNow } from "@/services/processing";
import { resolveExerciseIds } from "@/services/exercises/resolve";
import { buildKey, deleteObject, putObject } from "@/services/storage";

import type { ActionResult } from "./meals";

const ManualExerciseSchema = z.object({
  catalogId: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  weightKg: z.number().min(0).max(1000).nullable().optional(),
  sets: z.number().int().min(0).max(50).nullable().optional(),
  reps: z.number().int().min(0).max(500).nullable().optional(),
});

const ManualWorkoutSchema = z.object({
  title: z.string().trim().max(120).optional(),
  durationMin: z.number().int().min(0).max(600).nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
  performedAt: z.string().optional(),
  exercises: z.array(ManualExerciseSchema).min(1).max(40),
});

/**
 * Logs a workout built from the exercise catalog rather than dictated. Skips
 * AI entirely: the athlete has already given structured data, so there is
 * nothing to infer.
 */
export async function createManualWorkout(
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = ManualWorkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Add at least one exercise." };
  }

  const performedAt = parsed.data.performedAt
    ? new Date(parsed.data.performedAt)
    : new Date();
  if (Number.isNaN(performedAt.getTime())) {
    return { ok: false, error: "Invalid workout time." };
  }

  // Resolve anything typed free-hand so it still counts toward volume.
  const catalogIds = await resolveExerciseIds(
    parsed.data.exercises.map((e) => e.name),
  );

  const workout = await db.workout.create({
    data: {
      userId: user.id,
      title: parsed.data.title || "Workout",
      durationMin: parsed.data.durationMin ?? null,
      notes: parsed.data.notes || null,
      performedAt,
      status: "COMPLETE",
      exercises: {
        create: parsed.data.exercises.map((ex, i) => ({
          name: ex.name,
          weightKg: ex.weightKg ?? null,
          sets: ex.sets ?? null,
          reps: ex.reps ?? null,
          position: i,
          catalogId: ex.catalogId ?? catalogIds[i],
          // Same store as a live session: three sets of ten typed into this
          // form are three set rows, not one row saying "3 x 10".
          setLog: {
            create: expandToSets(
              ex.weightKg ?? null,
              ex.sets ?? null,
              ex.reps ?? null,
            ),
          },
        })),
      },
    },
    select: { id: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workouts");
  return { ok: true, id: workout.id };
}

const CreateSchema = z.object({
  description: z.string().max(4000).optional(),
  durationMin: z.coerce.number().int().min(0).max(600).optional(),
  performedAt: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

/** Logs a workout from a voice note and/or typed description. */
export async function createWorkout(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();

  // Shares the AI budget with meal logging: both spend the same OpenAI quota.
  try {
    await enforce("aiCreate", user.id, "You have logged a lot of sessions recently.");
    await enforce(
      "aiCreateDaily",
      user.id,
      "You have reached today's logging limit.",
    );
  } catch (err) {
    if (err instanceof RateLimited) return { ok: false, error: err.message };
    throw err;
  }

  let audio;
  try {
    audio = await readUpload(formData.get("audio"), "audio");
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const raw = {
    description: formData.get("description")?.toString() || undefined,
    durationMin: formData.get("durationMin")?.toString() || undefined,
    performedAt: formData.get("performedAt")?.toString() || undefined,
    notes: formData.get("notes")?.toString() || undefined,
  };

  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid workout details." };
  }

  const description = parsed.data.description?.trim() || null;
  if (!audio && !description) {
    return { ok: false, error: "Record a voice note or describe your session." };
  }

  const performedAt = parsed.data.performedAt
    ? new Date(parsed.data.performedAt)
    : new Date();
  if (Number.isNaN(performedAt.getTime())) {
    return { ok: false, error: "Invalid workout time." };
  }

  if (audio) {
    try {
      await enforce(
        "uploadBytes",
        user.id,
        "You have uploaded a lot today.",
        audio.buffer.byteLength,
      );
    } catch (err) {
      if (err instanceof RateLimited) return { ok: false, error: err.message };
      throw err;
    }
  }

  let audioKey: string | null = null;
  try {
    if (audio) {
      audioKey = buildKey(user.id, "workout", audio.contentType);
      await putObject(audioKey, audio.buffer, audio.contentType);
    }
  } catch {
    return { ok: false, error: "Upload failed. Please try again." };
  }

  const workout = await db.workout.create({
    data: {
      userId: user.id,
      audioKey,
      transcript: audio ? null : description,
      durationMin: parsed.data.durationMin ?? null,
      notes: parsed.data.notes?.trim() || null,
      performedAt,
      status: "PROCESSING",
    },
    select: { id: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workouts");

  const jobId = await enqueue("WORKOUT_PARSE", workout.id, user.id, {
    description,
  });

  after(async () => {
    await runNow(jobId);
  });

  return { ok: true, id: workout.id };
}

export async function reprocessWorkout(
  workoutId: string,
): Promise<ActionResult> {
  const user = await requireUser();

  const workout = await db.workout.findUnique({
    where: { id: workoutId },
    select: { userId: true },
  });
  if (!workout || workout.userId !== user.id) {
    return { ok: false, error: "Workout not found." };
  }

  try {
    await enforce(
      "aiReprocess",
      user.id,
      "You have re-analysed several entries recently.",
    );
  } catch (err) {
    if (err instanceof RateLimited) return { ok: false, error: err.message };
    throw err;
  }

  await db.workout.update({
    where: { id: workoutId },
    data: { status: "PROCESSING", error: null },
  });

  revalidatePath("/dashboard/workouts");

  const jobId = await enqueue("WORKOUT_PARSE", workoutId, user.id, null);
  after(async () => {
    await runNow(jobId);
  });

  return { ok: true, id: workoutId };
}

export async function deleteWorkout(
  workoutId: string,
): Promise<ActionResult> {
  const user = await requireUser();

  const workout = await db.workout.findUnique({
    where: { id: workoutId },
    select: { userId: true, audioKey: true },
  });
  if (!workout || workout.userId !== user.id) {
    return { ok: false, error: "Workout not found." };
  }

  await db.workout.delete({ where: { id: workoutId } });
  if (workout.audioKey) await deleteObject(workout.audioKey);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workouts");
  return { ok: true };
}
