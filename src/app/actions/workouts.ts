"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { readUpload } from "@/lib/uploads";
import { transcribeAudio } from "@/services/ai/transcribe";
import { parseWorkout } from "@/services/ai/workout";
import { buildKey, deleteObject, getObject, putObject } from "@/services/storage";

import type { ActionResult } from "./meals";

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
        audioKey: true,
        transcript: true,
        durationMin: true,
      },
    });
    if (!workout) return;

    let transcript = workout.transcript;

    if (workout.audioKey) {
      const audio = await getObject(workout.audioKey);
      const spoken = await transcribeAudio(
        audio,
        workout.audioKey.split("/").pop() ?? "note.webm",
      );
      transcript = [spoken, typedDescription].filter(Boolean).join(". ") || null;
    }

    const result = await parseWorkout(transcript);

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
