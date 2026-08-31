"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { MealItemSchema, totalsOf } from "@/lib/meal-items";
import { enqueue } from "@/lib/jobs";
import { enforce, RateLimited } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { readUpload } from "@/lib/uploads";
import { runNow } from "@/services/processing";
import { buildKey, deleteObject, putObject } from "@/services/storage";

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

  // Each meal buys a Whisper call and a gpt-4o vision call, so this is the
  // limit that governs the OpenAI bill.
  try {
    await enforce("aiCreate", user.id, "You have logged a lot of meals recently.");
    await enforce(
      "aiCreateDaily",
      user.id,
      "You have reached today's logging limit.",
    );
  } catch (err) {
    if (err instanceof RateLimited) return { ok: false, error: err.message };
    throw err;
  }

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

  // Storage is billed by the gigabyte; spend the real byte count so one large
  // upload costs what a hundred small ones would.
  const bytes = (image?.buffer.byteLength ?? 0) + (audio?.buffer.byteLength ?? 0);
  if (bytes > 0) {
    try {
      await enforce(
        "uploadBytes",
        user.id,
        "You have uploaded a lot today.",
        bytes,
      );
    } catch (err) {
      if (err instanceof RateLimited) return { ok: false, error: err.message };
      throw err;
    }
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

  const jobId = await enqueue("MEAL_ANALYSIS", meal.id, user.id, { description });

  // Try it inline so an ordinary upload finishes as fast as it always did —
  // but the queue, not this call, is what guarantees the job runs.
  after(async () => {
    await runNow(jobId);
  });

  return { ok: true, id: meal.id };
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

  // Tighter than logging: this re-runs the whole pipeline with no upload to
  // slow it down.
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

  await db.meal.update({
    where: { id: mealId },
    data: { status: "PROCESSING", error: null },
  });

  revalidatePath("/dashboard");

  const jobId = await enqueue("MEAL_ANALYSIS", mealId, user.id, null);
  after(async () => {
    await runNow(jobId);
  });

  return { ok: true, id: mealId };
}

const ItemsSchema = z.object({
  mealId: z.string().min(1),
  title: z.string().trim().max(120).optional(),
  slot: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]).nullable().optional(),
  items: z.array(MealItemSchema).max(40),
});

export type UpdateMealItemsInput = z.input<typeof ItemsSchema>;

/**
 * Replaces a meal's ingredient breakdown with the athlete's corrected one.
 *
 * The totals are recomputed from the lines rather than accepted from the
 * client: they are a derived figure, and letting a caller send both invites a
 * meal whose parts do not add up to its own total.
 */
export async function updateMealItems(
  input: UpdateMealItemsInput,
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = ItemsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the ingredient rows and try again." };
  }

  const meal = await db.meal.findUnique({
    where: { id: parsed.data.mealId },
    select: { userId: true },
  });
  if (!meal || meal.userId !== user.id) {
    return { ok: false, error: "Meal not found." };
  }

  const items = parsed.data.items;
  const totals = totalsOf(items);

  await db.meal.update({
    where: { id: parsed.data.mealId },
    data: {
      items,
      ...totals,
      ...(parsed.data.title !== undefined
        ? { title: parsed.data.title || null }
        : {}),
      ...(parsed.data.slot !== undefined ? { slot: parsed.data.slot } : {}),
      // A meal the athlete has read and corrected is finished, whatever the
      // job that produced it went on to do.
      status: "COMPLETE",
      error: null,
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
