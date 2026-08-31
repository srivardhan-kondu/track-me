"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  fromFeetInches,
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
} from "@/lib/units";
import { dayKeyInZone, safeZone } from "@/lib/tz";

import type { ActionResult } from "./meals";

/**
 * Everything onboarding asks for is optional. Someone who taps Skip on the
 * first screen still finishes onboarded — the flow exists to personalise the
 * app, never to stand between the athlete and it.
 */
const UnitSchema = z.object({
  weightUnit: z.enum(["KG", "LB"]).optional(),
  heightUnit: z.enum(["CM", "FT"]).optional(),
  volumeUnit: z.enum(["ML", "FL_OZ"]).optional(),
});

/*
  The figures are metric because onboarding converts before it submits — the
  sliders move in whichever unit is on screen, but what leaves the browser is
  what the column holds. The units come along so the choice made here is the
  one every later screen reads in.
*/
const OnboardingSchema = UnitSchema.extend({
  gender: z.enum(["FEMALE", "MALE"]).nullable().optional(),
  age: z.coerce.number().int().min(13).max(100).nullable().optional(),
  heightCm: z.coerce
    .number()
    .min(HEIGHT_MIN_CM)
    .max(HEIGHT_MAX_CM)
    .nullable()
    .optional(),
  weightKg: z.coerce
    .number()
    .min(WEIGHT_MIN_KG)
    .max(WEIGHT_MAX_KG)
    .nullable()
    .optional(),
});

export type OnboardingInput = z.input<typeof OnboardingSchema>;

export async function completeOnboarding(
  input: OnboardingInput,
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = OnboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Those numbers look out of range." };
  }

  const { gender, age, heightCm, weightKg, weightUnit, heightUnit, volumeUnit } =
    parsed.data;

  await db.user.update({
    where: { id: user.id },
    data: {
      // `?? undefined` rather than `?? null`: a field the athlete skipped is
      // left as it was instead of being overwritten with a blank.
      gender: gender ?? undefined,
      age: age ?? undefined,
      heightCm: heightCm ?? undefined,
      weightUnit: weightUnit ?? undefined,
      heightUnit: heightUnit ?? undefined,
      volumeUnit: volumeUnit ?? undefined,
      onboardedAt: new Date(),
    },
  });

  // The opening weight is a real check-in, so it lands in the same place every
  // later one does and shows up on the weight chart from day one.
  if (weightKg) {
    const day = dayKeyInZone(new Date(), safeZone(user.timeZone));
    await db.weightEntry.upsert({
      where: { userId_day: { userId: user.id, day } },
      create: { userId: user.id, day, weightKg },
      update: { weightKg },
    });
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

/** Marks onboarding done without recording anything. */
export async function skipOnboarding(): Promise<ActionResult> {
  const user = await requireUser();
  await db.user.update({
    where: { id: user.id },
    data: { onboardedAt: new Date() },
  });
  revalidatePath("/dashboard");
  return { ok: true };
}

const ProfileSchema = UnitSchema.extend({
  gender: z.enum(["FEMALE", "MALE", ""]).optional(),
  age: z.string().optional(),
  /** Centimetres, or the two halves of a height in feet — never both. */
  heightCm: z.string().optional(),
  heightFeet: z.string().optional(),
  heightInches: z.string().optional(),
});

/**
 * Updates the details onboarding collected. Every field is clearable, so a
 * blank input is stored as null rather than being ignored — this is where
 * somebody comes to *remove* an answer they would rather not have given.
 */
export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = ProfileSchema.safeParse({
    gender: formData.get("gender")?.toString() ?? "",
    age: formData.get("age")?.toString() ?? "",
    heightCm: formData.get("heightCm")?.toString() ?? "",
    heightFeet: formData.get("heightFeet")?.toString() ?? "",
    heightInches: formData.get("heightInches")?.toString() ?? "",
    weightUnit: formData.get("weightUnit")?.toString() || undefined,
    heightUnit: formData.get("heightUnit")?.toString() || undefined,
    volumeUnit: formData.get("volumeUnit")?.toString() || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Those details look wrong." };

  const age = parsed.data.age?.trim() ? Number(parsed.data.age) : null;

  // A height given in feet arrives as its two halves and is assembled here, so
  // the browser never decides what goes in a centimetre column. Blank feet
  // with blank inches clears the height, exactly as a blank cm field does.
  const feet = parsed.data.heightFeet?.trim();
  const inches = parsed.data.heightInches?.trim();
  const heightCm =
    parsed.data.heightUnit === "FT"
      ? feet || inches
        ? fromFeetInches(Number(feet || 0), Number(inches || 0))
        : null
      : parsed.data.heightCm?.trim()
        ? Number(parsed.data.heightCm)
        : null;

  if (age !== null && (!Number.isFinite(age) || age < 13 || age > 100)) {
    return { ok: false, error: "Enter an age between 13 and 100." };
  }
  if (
    heightCm !== null &&
    (!Number.isFinite(heightCm) ||
      heightCm < HEIGHT_MIN_CM ||
      heightCm > HEIGHT_MAX_CM)
  ) {
    return {
      ok: false,
      error:
        parsed.data.heightUnit === "FT"
          ? "Enter a height between 3′ 0″ and 8′ 2″."
          : `Enter a height between ${HEIGHT_MIN_CM} and ${HEIGHT_MAX_CM} cm.`,
    };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      gender: parsed.data.gender === "" ? null : parsed.data.gender,
      age,
      heightCm,
      weightUnit: parsed.data.weightUnit,
      heightUnit: parsed.data.heightUnit,
      volumeUnit: parsed.data.volumeUnit,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  // Changing a unit re-reads every figure on these screens, not just this one.
  revalidatePath("/dashboard/weight");
  revalidatePath("/dashboard/water");
  return { ok: true };
}
