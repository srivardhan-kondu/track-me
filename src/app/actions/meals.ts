"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { readUpload } from "@/lib/uploads";
import { analyzeMeal } from "@/services/ai/nutrition";
import { transcribeAudio } from "@/services/ai/transcribe";
import { buildKey, deleteObject, getObject, putObject } from "@/services/storage";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const CreateSchema = z.object({
  description: z.string().max(2000).optional(),
  eatenAt: z.string().optional(),
});

/**
 * Creates a meal, stores its media, and hands AI processing to `after()` so the
 * athlete's upload returns immediately. The client polls the meal's status.
 */
export async function createMeal(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  let image, audio;
  try {
    image = await readUpload(formData.get("image"), "image");
    audio = await readUpload(formData.get("audio"), "audio");
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const parsed = CreateSchema.safeParse({
    description: formData.get("description")?.toString() || undefined,
    eatenAt: formData.get("eatenAt")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid meal details." };
  }

  const description = parsed.data.description?.trim() || null;

  if (!image && !audio && !description) {
    return {
      ok: false,
      error: "Add a photo, a voice note, or a short description.",
    };
  }

  const eatenAt = parsed.data.eatenAt
    ? new Date(parsed.data.eatenAt)
    : new Date();
  if (Number.isNaN(eatenAt.getTime())) {
    return { ok: false, error: "Invalid meal time." };
  }

  let imageKey: string | null = null;
  let audioKey: string | null = null;

  try {
    if (image) {
      imageKey = buildKey(user.id, "meal", image.contentType);
      await putObject(imageKey, image.buffer, image.contentType);
    }
    if (audio) {
      audioKey = buildKey(user.id, "meal", audio.contentType);
      await putObject(audioKey, audio.buffer, audio.contentType);
    }
  } catch {
    if (imageKey) await deleteObject(imageKey);
    if (audioKey) await deleteObject(audioKey);
    return { ok: false, error: "Upload failed. Please try again." };
  }

  const meal = await db.meal.create({
    data: {
      userId: user.id,
      imageKey,
      audioKey,
      // A typed description is treated as the transcript when there is no audio.
      transcript: audio ? null : description,
      eatenAt,
      status: "PROCESSING",
    },
    select: { id: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/meals");

  after(async () => {
    await processMeal(meal.id, description);
  });

  return { ok: true, id: meal.id };
}

/** Runs transcription and nutrition estimation, then finalises the meal row. */
async function processMeal(mealId: string, typedDescription: string | null) {
  try {
    const meal = await db.meal.findUnique({
      where: { id: mealId },
      select: { imageKey: true, audioKey: true, transcript: true },
    });
    if (!meal) return;

    let transcript = meal.transcript;

    if (meal.audioKey) {
      const audio = await getObject(meal.audioKey);
      const spoken = await transcribeAudio(
        audio,
        meal.audioKey.split("/").pop() ?? "note.webm",
      );
      // Fall back to the typed description when speech-to-text is unavailable.
      transcript = [spoken, typedDescription].filter(Boolean).join(". ") || null;
    }

    let imagePayload = null;
    if (meal.imageKey) {
      const buffer = await getObject(meal.imageKey);
      const ext = meal.imageKey.split(".").pop()?.toLowerCase();
      imagePayload = {
        buffer,
        contentType:
          ext === "png"
            ? "image/png"
            : ext === "webp"
              ? "image/webp"
              : "image/jpeg",
      };
    }

    const result = await analyzeMeal({ transcript, image: imagePayload });

    await db.meal.update({
      where: { id: mealId },
      data: {
        transcript,
        title: result.title,
        slot: result.slot ?? undefined,
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        items: result.items,
        status: "COMPLETE",
        error: null,
      },
    });
  } catch (err) {
    await db.meal.update({
      where: { id: mealId },
      data: {
        status: "FAILED",
        error: (err as Error).message.slice(0, 400),
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/meals");
}

/** Re-runs AI processing for a meal that failed or was mis-estimated. */
export async function reprocessMeal(mealId: string): Promise<ActionResult> {
  const user = await requireUser();

  const meal = await db.meal.findUnique({
    where: { id: mealId },
    select: { userId: true },
  });
  if (!meal || meal.userId !== user.id) {
    return { ok: false, error: "Meal not found." };
  }

  await db.meal.update({
    where: { id: mealId },
    data: { status: "PROCESSING", error: null },
  });

  revalidatePath("/dashboard");
  after(async () => {
    await processMeal(mealId, null);
  });

  return { ok: true, id: mealId };
}

const MacroSchema = z.object({
  mealId: z.string().min(1),
  title: z.string().max(120).optional(),
  calories: z.coerce.number().min(0).max(20000),
  protein: z.coerce.number().min(0).max(2000),
  carbs: z.coerce.number().min(0).max(2000),
  fat: z.coerce.number().min(0).max(2000),
});

/** Lets an athlete correct the AI's estimate. */
export async function updateMealMacros(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = MacroSchema.safeParse({
    mealId: formData.get("mealId"),
    title: formData.get("title")?.toString() || undefined,
    calories: formData.get("calories"),
    protein: formData.get("protein"),
    carbs: formData.get("carbs"),
    fat: formData.get("fat"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Enter valid numbers for each macro." };
  }

  const meal = await db.meal.findUnique({
    where: { id: parsed.data.mealId },
    select: { userId: true },
  });
  if (!meal || meal.userId !== user.id) {
    return { ok: false, error: "Meal not found." };
  }

  await db.meal.update({
    where: { id: parsed.data.mealId },
    data: {
      title: parsed.data.title,
      calories: parsed.data.calories,
      protein: parsed.data.protein,
      carbs: parsed.data.carbs,
      fat: parsed.data.fat,
      status: "COMPLETE",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/meals");
  return { ok: true };
}

export async function deleteMeal(mealId: string): Promise<ActionResult> {
  const user = await requireUser();

  const meal = await db.meal.findUnique({
    where: { id: mealId },
    select: { userId: true, imageKey: true, audioKey: true },
  });
  if (!meal || meal.userId !== user.id) {
    return { ok: false, error: "Meal not found." };
  }

  await db.meal.delete({ where: { id: mealId } });

  if (meal.imageKey) await deleteObject(meal.imageKey);
  if (meal.audioKey) await deleteObject(meal.audioKey);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/meals");
  return { ok: true };
}
