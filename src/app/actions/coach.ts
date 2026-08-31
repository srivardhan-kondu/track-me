"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { enforce, RateLimited } from "@/lib/rate-limit";
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

  // Writes into somebody else's timeline, so it needs a spam ceiling.
  try {
    await enforce("comment", user.id, "You have posted a lot of feedback.");
  } catch (err) {
    if (err instanceof RateLimited) return { ok: false, error: err.message };
    throw err;
  }

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

/**
 * A coach asks an athlete for access.
 *
 * This creates a PENDING link and nothing more. It grants no visibility of the
 * athlete's data — only they can do that, by accepting. Previously this wrote
 * a link that `assertCanViewAthlete` honoured immediately, which meant an
 * email address was all anyone needed to read another person's meals, weight
 * history and progress photos.
 *
 * The response is deliberately the same whether or not the address belongs to
 * an account. Distinguishing them turns this into an oracle for testing which
 * email addresses are registered.
 */
export async function linkAthlete(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "COACH") {
    return { ok: false, error: "Only coaches can request access." };
  }

  try {
    await enforce("linkAthlete", user.id, "You have sent a lot of requests today.");
  } catch (err) {
    if (err instanceof RateLimited) return { ok: false, error: err.message };
    throw err;
  }

  const email = formData.get("email")?.toString().trim().toLowerCase();
  if (!email || !z.string().email().safeParse(email).success) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const athlete = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  // Same outcome for an unknown address as for a real one.
  if (!athlete || athlete.id === user.id) {
    return { ok: true };
  }

  await db.coachAthlete.upsert({
    where: { coachId_athleteId: { coachId: user.id, athleteId: athlete.id } },
    create: { coachId: user.id, athleteId: athlete.id, status: "PENDING" },
    // A previously declined coach may ask again, but re-asking never revives
    // an old acceptance and never clears a decision the athlete already made.
    update: {},
  });

  revalidatePath("/trainer");
  return { ok: true };
}

/**
 * The athlete answers a coach's request. This is the only path that grants
 * access to their data.
 */
export async function respondToCoachRequest(
  coachId: string,
  accept: boolean,
): Promise<ActionResult> {
  const user = await requireUser();

  // Scoped to the caller as the athlete, so nobody can answer on their behalf.
  const { count } = await db.coachAthlete.updateMany({
    where: { coachId, athleteId: user.id, status: "PENDING" },
    data: {
      status: accept ? "ACCEPTED" : "DECLINED",
      respondedAt: new Date(),
    },
  });

  if (count === 0) return { ok: false, error: "That request is no longer open." };

  revalidatePath("/dashboard/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** An athlete withdraws access they previously granted. */
export async function revokeCoachAccess(coachId: string): Promise<ActionResult> {
  const user = await requireUser();

  await db.coachAthlete.deleteMany({
    where: { coachId, athleteId: user.id },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/", "layout");
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

/**
 * Switches between the athlete and coach experience.
 *
 * Self-serve on purpose, and safe now that it is: coaching grants nothing on
 * its own. A COACH with no ACCEPTED links can see exactly what any other
 * account can, which is their own data. Before the consent change this
 * function was the first step of a privilege escalation — switch role, add a
 * victim by email, read their history — so if the link ever stops requiring
 * acceptance, this needs a gate again.
 */
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

/**
 * Records the athlete's IANA timezone, detected in the browser. Everything
 * date-related is bucketed and rendered in this zone.
 */
export async function setTimeZone(timeZone: string): Promise<ActionResult> {
  const user = await requireUser();

  // Validate against Intl rather than a list, and ignore anything unusable.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  } catch {
    return { ok: false, error: "Unrecognised timezone." };
  }

  const existing = await db.user.findUnique({
    where: { id: user.id },
    select: { timeZone: true },
  });
  if (existing?.timeZone === timeZone) return { ok: true };

  await db.user.update({ where: { id: user.id }, data: { timeZone } });
  revalidatePath("/", "layout");
  return { ok: true };
}
