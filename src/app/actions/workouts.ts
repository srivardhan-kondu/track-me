"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { premiumStatus, requireUser } from "@/lib/session";
import { readUpload } from "@/lib/uploads";
import { transcribeAudio } from "@/services/ai/transcribe";
import { parseWorkout } from "@/services/ai/workout";
import { resolveExerciseIds } from "@/services/exercises/resolve";
import { buildKey, deleteObject, getObject, putObject } from "@/services/storage";

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

  after(async () => {
    await processWorkout(workout.id, description);
  });

  return { ok: true, id: workout.id };
}

async function processWorkout(
  workoutId: string,
  typedDescription: string | null,
) {
  try {
    const workout = await db.workout.findUnique({
      where: { id: workoutId },
      select: {
        userId: true,
        audioKey: true,
        transcript: true,
        durationMin: true,
      },
    });
    if (!workout) return;

    // Read the plan here rather than at submission: this runs in after(), and
    // a trial that lapsed in between should not still buy a parse.
    const { premium } = await premiumStatus(workout.userId);

    let transcript = workout.transcript;

    if (workout.audioKey) {
      const audio = await getObject(workout.audioKey);
      const spoken = await transcribeAudio(
        audio,
        workout.audioKey.split("/").pop() ?? "note.webm",
        premium,
      );
      transcript = [spoken, typedDescription].filter(Boolean).join(". ") || null;
    }

    const result = await parseWorkout(transcript, premium);

    // Attach each movement to the catalog so its sets count toward muscle
    // volume. An unrecognised name still logs, just without attribution.
    const catalogIds = await resolveExerciseIds(
      result.exercises.map((e) => e.name),
    );

    await db.$transaction([
      // Replace any prior parse so a re-run does not duplicate exercises.
      db.exercise.deleteMany({ where: { workoutId } }),
      db.workout.update({
        where: { id: workoutId },
        data: {
          transcript,
          title: result.title,
          // Never overwrite a duration the athlete entered by hand.
          durationMin: workout.durationMin ?? result.durationMin,
          status: "COMPLETE",
          error: null,
          exercises: {
            create: result.exercises.map((ex, i) => ({
              name: ex.name,
              weightKg: ex.weightKg,
              sets: ex.sets,
              reps: ex.reps,
              position: i,
              catalogId: catalogIds[i],
            })),
          },
        },
      }),
    ]);
  } catch (err) {
    await db.workout.update({
      where: { id: workoutId },
      data: {
        status: "FAILED",
        error: (err as Error).message.slice(0, 400),
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workouts");
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

  await db.workout.update({
    where: { id: workoutId },
    data: { status: "PROCESSING", error: null },
  });

  revalidatePath("/dashboard/workouts");
  after(async () => {
    await processWorkout(workoutId, null);
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
