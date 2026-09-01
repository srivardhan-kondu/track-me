/**
 * The rules behind the two targets an athlete sets for themselves.
 *
 * Kept out of the server action so they can be tested without a session and a
 * database, and so the form and the action agree on the same bounds instead of
 * each carrying their own copy.
 */

import { toKg, WEIGHT_MAX_KG, WEIGHT_MIN_KG, type WeightUnit } from "./units";

/**
 * Wide enough for a hard cut and a heavy bulk, narrow enough that a typo lands
 * outside it. A four-figure day is real; a five-figure one is a slipped key.
 */
export const MIN_TARGET_CALORIES = 800;
export const MAX_TARGET_CALORIES = 8000;

export type GoalResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * Blank is a real answer, and it means "stop measuring me against this".
 *
 * Which is why these arrive as strings: `Number("")` is 0 and a coerced schema
 * would read a cleared field as a target of zero calories.
 */
export function parseCalorieTarget(raw: string): GoalResult<number | null> {
  const value = raw.trim();
  if (value === "") return { ok: true, value: null };

  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: "Enter a calorie target, or leave it blank." };
  }

  if (n < MIN_TARGET_CALORIES || n > MAX_TARGET_CALORIES) {
    return {
      ok: false,
      error: `A daily target belongs between ${MIN_TARGET_CALORIES.toLocaleString()} and ${MAX_TARGET_CALORIES.toLocaleString()} kcal.`,
    };
  }

  return { ok: true, value: Math.round(n) };
}

/** Typed in whatever unit is on screen; returned in the kilograms we store. */
export function parseWeightTarget(
  raw: string,
  unit: WeightUnit,
): GoalResult<number | null> {
  const value = raw.trim();
  if (value === "") return { ok: true, value: null };

  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: "Enter a goal weight, or leave it blank." };
  }

  const kg = toKg(n, unit);
  if (kg < WEIGHT_MIN_KG || kg > WEIGHT_MAX_KG) {
    return {
      ok: false,
      error: "That goal weight is outside the range we store.",
    };
  }

  return { ok: true, value: kg };
}
