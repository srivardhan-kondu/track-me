"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { parseCalorieTarget, parseWeightTarget } from "@/lib/goals";
import { requireUser } from "@/lib/session";
import type { WeightUnit } from "@/lib/units";

import type { ActionResult } from "./meals";

/**
 * The two targets an athlete sets for themselves.
 *
 * Both are nullable, and blank is a real answer rather than a failed one:
 * clearing a target is how somebody stops being measured against it. Unlike
 * water there is no default to fall back to — a calorie number depends on
 * bodyweight, training load and whether they are cutting, and a goal weight is
 * nobody's business to guess.
 *
 * The rules themselves live in `lib/goals`, so they can be tested without a
 * session and the form can share the same bounds.
 */

const Schema = z.object({
  calories: z.string().max(8),
  weight: z.string().max(8),
  unit: z.enum(["KG", "LB"]).optional(),
});

export async function updateGoals(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = Schema.safeParse({
    calories: formData.get("calories")?.toString() ?? "",
    weight: formData.get("weight")?.toString() ?? "",
    unit: formData.get("unit")?.toString() || undefined,
  });

  if (!parsed.success) return { ok: false, error: "Check those numbers." };

  const unit = (parsed.data.unit ?? "KG") as WeightUnit;

  const calories = parseCalorieTarget(parsed.data.calories);
  if (!calories.ok) return { ok: false, error: calories.error };

  const weight = parseWeightTarget(parsed.data.weight, unit);
  if (!weight.ok) return { ok: false, error: weight.error };

  await db.user.update({
    where: { id: user.id },
    data: {
      targetCalories: calories.value,
      targetWeightKg: weight.value,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/weight");

  return { ok: true };
}
