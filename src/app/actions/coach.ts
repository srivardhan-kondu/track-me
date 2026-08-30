"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { assertCanViewAthlete, requireUser } from "@/lib/session";

import type { ActionResult } from "./meals";

const CommentSchema = z
  .object({
    body: z.string().trim().min(1, "Write something first.").max(2000),
    mealId: z.string().optional(),
    workoutId: z.string().optional(),
    weightEntryId: z.string().optional(),
  })
  .refine(
    (v) =>
      [v.mealId, v.workoutId, v.weightEntryId].filter(Boolean).length === 1,
    "A comment must attach to exactly one record.",
  );

/** Leaves feedback on a meal, workout or weigh-in. */
export async function addComment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = CommentSchema.safeParse({
    body: formData.get("body")?.toString() ?? "",
    mealId: formData.get("mealId")?.toString() || undefined,
    workoutId: formData.get("workoutId")?.toString() || undefined,
    weightEntryId: formData.get("weightEntryId")?.toString() || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid comment.",
    };
  }

  const { body, mealId, workoutId, weightEntryId } = parsed.data;

  // Resolve who owns the record so we can authorise the commenter.
  let ownerId: string | null = null;
  if (mealId) {
    const meal = await db.meal.findUnique({
      where: { id: mealId },
      select: { userId: true },
    });
    ownerId = meal?.userId ?? null;
  } else if (workoutId) {
    const workout = await db.workout.findUnique({
      where: { id: workoutId },
      select: { userId: true },
    });
    ownerId = workout?.userId ?? null;
  } else if (weightEntryId) {
    const entry = await db.weightEntry.findUnique({
      where: { id: weightEntryId },
      select: { userId: true },
    });
    ownerId = entry?.userId ?? null;
  }

  if (!ownerId) return { ok: false, error: "Record not found." };

  try {
    await assertCanViewAthlete(user.id, ownerId);
  } catch {
    return { ok: false, error: "You cannot comment on this record." };
  }

  await db.comment.create({
    data: {
      authorId: user.id,
      body,
      mealId: mealId ?? null,
      workoutId: workoutId ?? null,
      weightEntryId: weightEntryId ?? null,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/trainer/${ownerId}`);
  return { ok: true };
}

export async function deleteComment(id: string): Promise<ActionResult> {
  const user = await requireUser();

  const comment = await db.comment.findUnique({
    where: { id },
    select: { authorId: true },
  });
  if (!comment || comment.authorId !== user.id) {
    return { ok: false, error: "Comment not found." };
  }

  await db.comment.delete({ where: { id } });
  revalidatePath("/dashboard");
  revalidatePath("/trainer");
  return { ok: true };
}

/** A coach adds an athlete to their roster by email. */
export async function linkAthlete(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "COACH") {
    return { ok: false, error: "Only coaches can add athletes." };
  }

  const email = formData.get("email")?.toString().trim().toLowerCase();
  if (!email || !z.string().email().safeParse(email).success) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const athlete = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (!athlete) {
    return {
      ok: false,
      error: "No GymOS account with that email yet. Ask them to sign up first.",
    };
  }
  if (athlete.id === user.id) {
    return { ok: false, error: "You cannot add yourself." };
  }

  await db.coachAthlete.upsert({
    where: { coachId_athleteId: { coachId: user.id, athleteId: athlete.id } },
    create: { coachId: user.id, athleteId: athlete.id },
    update: {},
  });

  revalidatePath("/trainer");
  return { ok: true };
}

export async function unlinkAthlete(
  athleteId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "COACH") {
    return { ok: false, error: "Only coaches can manage a roster." };
  }

  await db.coachAthlete.deleteMany({
    where: { coachId: user.id, athleteId },
  });

  revalidatePath("/trainer");
  return { ok: true };
}

const RoleSchema = z.enum(["ATHLETE", "COACH"]);

/** Switches between the athlete and coach experience. */
export async function updateRole(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = RoleSchema.safeParse(formData.get("role"));
  if (!parsed.success) return { ok: false, error: "Invalid role." };

  await db.user.update({
    where: { id: user.id },
    data: { role: parsed.data },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
