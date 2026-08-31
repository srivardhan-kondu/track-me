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
import { mlToFlOz, toMl, type VolumeUnit } from "@/lib/units";
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

/*
  As on a weigh-in: the amount arrives in whatever the athlete reads and is
  converted here, because the column is millilitres and a browser that posts
  its own conversion is a browser that can post ounces into it.
*/
const SetSchema = z.object({
  amount: z.coerce.number().min(0),
  unit: z.enum(["ML", "FL_OZ"]).default("ML"),
  day: z.string().optional(),
});

/**
 * Writes a day's total outright, for correcting a day rather than adding to
 * it — including yesterday, which the quick adds deliberately cannot reach.
 */
export async function setWater(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = SetSchema.safeParse({
    amount: formData.get("amount"),
    unit: formData.get("unit")?.toString() || undefined,
    day: formData.get("day")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "That does not look like an amount." };
  }

  const ml = toMl(parsed.data.amount, parsed.data.unit as VolumeUnit);
  if (ml < 0 || ml > MAX_WATER_DAY_ML) {
    return {
      ok: false,
      error: `That is more than anyone drinks in a day. Keep it under ${MAX_WATER_DAY_ML} ml.`,
    };
  }

  const bucket = bucketFor(parsed.data.day, user.timeZone);
  if (!bucket) return { ok: false, error: "Invalid date." };

  if (ml === 0) {
    // Setting a day to nothing is deleting it; an empty row would otherwise
    // read as "logged, drank none" on every strip that counts logged days.
    await db.waterEntry.deleteMany({ where: { userId: user.id, day: bucket } });
  } else {
    await db.waterEntry.upsert({
      where: { userId_day: { userId: user.id, day: bucket } },
      create: { userId: user.id, day: bucket, ml },
      update: { ml },
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
  goal: z.coerce.number().positive().nullable(),
  unit: z.enum(["ML", "FL_OZ"]).default("ML"),
});

/**
 * Sets the daily target. Clearing the field puts the athlete back on the
 * app's default rather than leaving them with no target at all.
 */
export async function updateWaterGoal(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();

  const raw = formData.get("goal")?.toString().trim() ?? "";
  const unit: VolumeUnit =
    formData.get("unit")?.toString() === "FL_OZ" ? "FL_OZ" : "ML";
  const parsed = GoalSchema.safeParse({ goal: raw === "" ? null : raw, unit });

  const goalMl =
    parsed.success && parsed.data.goal !== null
      ? toMl(parsed.data.goal, unit)
      : null;

  if (
    !parsed.success ||
    (goalMl !== null &&
      (goalMl < MIN_WATER_GOAL_ML || goalMl > MAX_WATER_GOAL_ML))
  ) {
    // Bounds spoken in the unit the athlete just typed in, not in the one the
    // column happens to hold.
    const low =
      unit === "FL_OZ" ? Math.ceil(mlToFlOz(MIN_WATER_GOAL_ML)) : MIN_WATER_GOAL_ML;
    const high =
      unit === "FL_OZ" ? Math.floor(mlToFlOz(MAX_WATER_GOAL_ML)) : MAX_WATER_GOAL_ML;
    return {
      ok: false,
      error: `Enter a goal between ${low} and ${high} ${
        unit === "FL_OZ" ? "fl oz" : "ml"
      }, or leave it blank.`,
    };
  }

  await db.user.update({
    where: { id: user.id },
    data: { waterGoalMl: goalMl },
  });

  revalidate();
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
