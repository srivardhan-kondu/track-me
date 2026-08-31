"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  MAX_WATER_DAY_ML,
  MAX_WATER_GOAL_ML,
  MIN_WATER_GOAL_ML,
} from "@/lib/hydration";
import { requireUser } from "@/lib/session";
import { dayKeyInZone, safeZone } from "@/lib/tz";

import type { ActionResult } from "./meals";

/**
 * The date-only bucket a log belongs to: an explicit YYYY-MM-DD is already a
 * calendar date and becomes the bucket directly, while "today" is resolved in
 * the athlete's own zone. Same rule as a weigh-in, so a glass drunk at 00:30
 * in IST lands on the day the athlete is actually living.
 */
function bucketFor(day: string | undefined, timeZone: string | null): Date | null {
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const [y, m, d] = day.split("-").map(Number);
    const at = new Date(Date.UTC(y, m - 1, d));
    return Number.isNaN(at.getTime()) ? null : at;
  }
  return dayKeyInZone(new Date(), safeZone(timeZone));
}

function revalidate() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/water");
}

/** A single tap is a glass or a bottle, and undoing one is the same tap negated. */
const AddSchema = z.object({
  ml: z.coerce.number().int().min(-2000).max(2000),
  day: z.string().optional(),
});

/**
 * Adds (or, with a negative amount, takes back) millilitres on one day.
 *
 * Incremented in the database rather than read-modify-written here: hydration
 * is logged by tapping the same button several times in a row, and two taps
 * racing each other must total two glasses, not one.
 */
export async function addWater(
  ml: number,
  day?: string,
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = AddSchema.safeParse({ ml, day });
  if (!parsed.success || parsed.data.ml === 0) {
    return { ok: false, error: "That is not an amount we can log." };
  }

  const bucket = bucketFor(parsed.data.day, user.timeZone);
  if (!bucket) return { ok: false, error: "Invalid date." };

  const amount = parsed.data.ml;

  const entry = await db.waterEntry.upsert({
    where: { userId_day: { userId: user.id, day: bucket } },
    // A negative first tap has nothing to take back, so it starts at zero.
    create: { userId: user.id, day: bucket, ml: Math.max(0, amount) },
    update: { ml: { increment: amount } },
  });

  // Clamped after the fact rather than before: the increment above is what
  // keeps concurrent taps honest, and only its result can be checked.
  if (entry.ml <= 0) {
    await db.waterEntry.delete({ where: { id: entry.id } });
  } else if (entry.ml > MAX_WATER_DAY_ML) {
    await db.waterEntry.update({
      where: { id: entry.id },
      data: { ml: MAX_WATER_DAY_ML },
    });
  }

  revalidate();
  return { ok: true };
}

const SetSchema = z.object({
  ml: z.coerce.number().int().min(0).max(MAX_WATER_DAY_ML),
  day: z.string().optional(),
});

/**
 * Writes a day's total outright, for correcting a day rather than adding to
 * it — including yesterday, which the quick adds deliberately cannot reach.
 */
export async function setWater(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = SetSchema.safeParse({
    ml: formData.get("ml"),
    day: formData.get("day")?.toString() || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: `Enter an amount between 0 and ${MAX_WATER_DAY_ML} ml.`,
    };
  }

  const bucket = bucketFor(parsed.data.day, user.timeZone);
  if (!bucket) return { ok: false, error: "Invalid date." };

  if (parsed.data.ml === 0) {
    // Setting a day to nothing is deleting it; an empty row would otherwise
    // read as "logged, drank none" on every strip that counts logged days.
    await db.waterEntry.deleteMany({ where: { userId: user.id, day: bucket } });
  } else {
    await db.waterEntry.upsert({
      where: { userId_day: { userId: user.id, day: bucket } },
      create: { userId: user.id, day: bucket, ml: parsed.data.ml },
      update: { ml: parsed.data.ml },
    });
  }

  revalidate();
  return { ok: true };
}

export async function deleteWaterEntry(id: string): Promise<ActionResult> {
  const user = await requireUser();

  const entry = await db.waterEntry.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!entry || entry.userId !== user.id) {
    return { ok: false, error: "Entry not found." };
  }

  await db.waterEntry.delete({ where: { id } });

  revalidate();
  return { ok: true };
}

const GoalSchema = z.object({
  waterGoalMl: z.coerce
    .number()
    .int()
    .min(MIN_WATER_GOAL_ML)
    .max(MAX_WATER_GOAL_ML)
    .nullable(),
});

/**
 * Sets the daily target. Clearing the field puts the athlete back on the
 * app's default rather than leaving them with no target at all.
 */
export async function updateWaterGoal(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();

  const raw = formData.get("waterGoalMl")?.toString().trim() ?? "";
  const parsed = GoalSchema.safeParse({ waterGoalMl: raw === "" ? null : raw });
  if (!parsed.success) {
    return {
      ok: false,
      error: `Enter a goal between ${MIN_WATER_GOAL_ML} and ${MAX_WATER_GOAL_ML} ml, or leave it blank.`,
    };
  }

  await db.user.update({
    where: { id: user.id },
    data: { waterGoalMl: parsed.data.waterGoalMl },
  });

  revalidate();
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
