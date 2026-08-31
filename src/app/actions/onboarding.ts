"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { dayKeyInZone, safeZone } from "@/lib/tz";

import type { ActionResult } from "./meals";

/**
 * Everything onboarding asks for is optional. Someone who taps Skip on the
 * first screen still finishes onboarded — the flow exists to personalise the
 * app, never to stand between the athlete and it.
 */
const OnboardingSchema = z.object({
  gender: z.enum(["FEMALE", "MALE"]).nullable().optional(),
  age: z.coerce.number().int().min(13).max(100).nullable().optional(),
  heightCm: z.coerce.number().min(90).max(250).nullable().optional(),
  weightKg: z.coerce.number().min(20).max(400).nullable().optional(),
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

  const { gender, age, heightCm, weightKg } = parsed.data;

  await db.user.update({
    where: { id: user.id },
    data: {
      // `?? undefined` rather than `?? null`: a field the athlete skipped is
      // left as it was instead of being overwritten with a blank.
      gender: gender ?? undefined,
      age: age ?? undefined,
      heightCm: heightCm ?? undefined,
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

const ProfileSchema = z.object({
  gender: z.enum(["FEMALE", "MALE", ""]).optional(),
  age: z.string().optional(),
  heightCm: z.string().optional(),
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
  });
  if (!parsed.success) return { ok: false, error: "Those details look wrong." };

  const age = parsed.data.age?.trim() ? Number(parsed.data.age) : null;
  const heightCm = parsed.data.heightCm?.trim()
    ? Number(parsed.data.heightCm)
    : null;

  if (age !== null && (!Number.isFinite(age) || age < 13 || age > 100)) {
    return { ok: false, error: "Enter an age between 13 and 100." };
  }
  if (
    heightCm !== null &&
    (!Number.isFinite(heightCm) || heightCm < 90 || heightCm > 250)
  ) {
    return { ok: false, error: "Enter a height between 90 and 250 cm." };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      gender: parsed.data.gender === "" ? null : parsed.data.gender,
      age,
      heightCm,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
