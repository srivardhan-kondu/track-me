"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { expiryFor, planUpdateFor, type PlanTerm } from "@/lib/entitlements";
import { claim, enqueue, inFlight, MAX_IN_FLIGHT, purgeFinished } from "@/lib/jobs";
import { emailIsAdmin, inr } from "@/lib/admin";
import { assertAdmin } from "@/lib/session";
import { recordAudit } from "@/services/admin";
import { runJob, runNow } from "@/services/processing";

import type { ActionResult } from "./meals";

/**
 * Everything the admin console can change.
 *
 * Three rules hold for all of them, and are worth stating once rather than
 * repeating in every function:
 *
 *   1. `assertAdmin()` first, always. These actions are reachable by anyone
 *      who can post to the endpoint, not only by someone looking at the page,
 *      so the page's own guard protects nothing here.
 *   2. Every write is audited before it is applied, including the ones that
 *      turn out to be no-ops. An action that fails halfway should still leave
 *      a trace of having been attempted.
 *   3. Nothing silently widens its own blast radius. Deleting an account
 *      requires the email typed back; nobody can revoke the last admin, or
 *      their own.
 */

const ADMIN_PATHS = [
  "/admin",
  "/admin/users",
  "/admin/payments",
  "/admin/jobs",
  "/admin/system",
  "/admin/audit",
];

function refresh(...extra: string[]) {
  for (const path of [...ADMIN_PATHS, ...extra]) revalidatePath(path);
}

const TERMS = ["MONTHLY", "YEARLY", "LIFETIME"] as const;

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

const PlanSchema = z.object({
  userId: z.string().min(1),
  term: z.enum([...TERMS, "FREE"]),
  reason: z.string().trim().max(280).optional(),
});

/**
 * Grants or revokes Premium by hand.
 *
 * Grants go through the same `planUpdateFor` the webhook uses, so access
 * comped from here expires exactly as bought access does — including the rule
 * that a lifetime plan is never overwritten by a shorter one. No Payment row
 * is written: no money moved, and inventing one would put revenue on this
 * dashboard that never arrived.
 */
export async function setPlan(formData: FormData): Promise<ActionResult> {
  const admin = await assertAdmin();

  const parsed = PlanSchema.safeParse({
    userId: formData.get("userId")?.toString() ?? "",
    term: formData.get("term")?.toString() ?? "",
    reason: formData.get("reason")?.toString() || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Pick a plan first." };

  const { userId, term, reason } = parsed.data;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      plan: true,
      planTerm: true,
      planExpiresAt: true,
    },
  });
  if (!user) return { ok: false, error: "No such account." };

  if (term === "FREE") {
    await recordAudit({
      actor: admin,
      action: "user.plan.revoke",
      targetType: "user",
      targetId: userId,
      summary: `Revoked Premium from ${user.email ?? userId}`,
      meta: {
        from: user.planTerm,
        expiredAt: user.planExpiresAt?.toISOString() ?? null,
        reason: reason ?? null,
      },
    });

    await db.user.update({
      where: { id: userId },
      data: { plan: "FREE", planTerm: null, planExpiresAt: null },
    });

    refresh(`/admin/users/${userId}`);
    return { ok: true };
  }

  const update = planUpdateFor(user, term as PlanTerm, new Date());

  await recordAudit({
    actor: admin,
    action: "user.plan.grant",
    targetType: "user",
    targetId: userId,
    summary: update
      ? `Granted ${term} to ${user.email ?? userId}`
      : `Left ${user.email ?? userId} on their lifetime plan`,
    meta: {
      term,
      from: user.planTerm,
      until: update?.planExpiresAt?.toISOString() ?? null,
      reason: reason ?? null,
      /** Comped access, so nothing here should ever be counted as revenue. */
      paid: false,
    },
  });

  // planUpdateFor returns null only when a lifetime plan already covers this,
  // which is a deliberate no-op rather than a failure.
  if (update) await db.user.update({ where: { id: userId }, data: update });

  refresh(`/admin/users/${userId}`);
  return { ok: true };
}

const TrialSchema = z.object({
  userId: z.string().min(1),
  days: z.coerce.number().int().min(1).max(365),
});

/**
 * Adds days to a trial.
 *
 * Extends from whichever is later, today or the current end date, so topping
 * up a live trial does not shorten it.
 */
export async function extendTrial(formData: FormData): Promise<ActionResult> {
  const admin = await assertAdmin();

  const parsed = TrialSchema.safeParse({
    userId: formData.get("userId")?.toString() ?? "",
    days: formData.get("days")?.toString() ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Enter 1 to 365 days." };

  const { userId, days } = parsed.data;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, trialEndsAt: true },
  });
  if (!user) return { ok: false, error: "No such account." };

  const now = new Date();
  const from =
    user.trialEndsAt && user.trialEndsAt > now ? user.trialEndsAt : now;
  const trialEndsAt = new Date(from.getTime() + days * 86_400_000);

  await recordAudit({
    actor: admin,
    action: "user.trial.extend",
    targetType: "user",
    targetId: userId,
    summary: `Extended ${user.email ?? userId}'s trial by ${days} day${days === 1 ? "" : "s"}`,
    meta: {
      days,
      from: user.trialEndsAt?.toISOString() ?? null,
      to: trialEndsAt.toISOString(),
    },
  });

  await db.user.update({ where: { id: userId }, data: { trialEndsAt } });

  refresh(`/admin/users/${userId}`);
  return { ok: true };
}

const RoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ATHLETE", "COACH"]),
});

export async function setRole(formData: FormData): Promise<ActionResult> {
  const admin = await assertAdmin();

  const parsed = RoleSchema.safeParse({
    userId: formData.get("userId")?.toString() ?? "",
    role: formData.get("role")?.toString() ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Pick a role." };

  const { userId, role } = parsed.data;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  });
  if (!user) return { ok: false, error: "No such account." };
  if (user.role === role) return { ok: true };

  await recordAudit({
    actor: admin,
    action: "user.role.set",
    targetType: "user",
    targetId: userId,
    summary: `Made ${user.email ?? userId} a ${role.toLowerCase()}`,
    meta: { from: user.role, to: role },
  });

  await db.user.update({ where: { id: userId }, data: { role } });

  refresh(`/admin/users/${userId}`);
  return { ok: true };
}

const AdminSchema = z.object({
  userId: z.string().min(1),
  grant: z.enum(["true", "false"]),
});

/**
 * Grants or revokes console access.
 *
 * Two things are refused outright. Nobody may revoke their own admin — the
 * mistake is one click and the recovery is a redeploy. And the last admin
 * cannot be removed, because an account with the column set is the only way
 * back in for a deployment that has no ADMIN_EMAILS configured.
 */
export async function setAdmin(formData: FormData): Promise<ActionResult> {
  const admin = await assertAdmin();

  const parsed = AdminSchema.safeParse({
    userId: formData.get("userId")?.toString() ?? "",
    grant: formData.get("grant")?.toString() ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const { userId } = parsed.data;
  const grant = parsed.data.grant === "true";

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, isAdmin: true },
  });
  if (!user) return { ok: false, error: "No such account." };

  if (!grant) {
    if (userId === admin.id) {
      return {
        ok: false,
        error: "You cannot remove your own admin access. Ask another admin.",
      };
    }
    const others = await db.user.count({
      where: { isAdmin: true, id: { not: userId } },
    });
    if (others === 0) {
      return {
        ok: false,
        error:
          "This is the last admin account. Grant someone else access first.",
      };
    }
  }

  await recordAudit({
    actor: admin,
    action: grant ? "user.admin.grant" : "user.admin.revoke",
    targetType: "user",
    targetId: userId,
    summary: `${grant ? "Granted" : "Revoked"} admin access ${grant ? "to" : "from"} ${user.email ?? userId}`,
  });

  await db.user.update({ where: { id: userId }, data: { isAdmin: grant } });

  refresh(`/admin/users/${userId}`);
  return { ok: true };
}

const DeleteSchema = z.object({
  userId: z.string().min(1),
  confirm: z.string().trim().min(1),
});

/**
 * Deletes an account and everything hanging off it.
 *
 * The email has to be typed back, because there is no undo: meals, workouts,
 * weigh-ins, photos and comments all cascade. Payments do not — they are
 * detached rather than deleted, since the money is a fact about the business
 * whatever happens to the account that spent it.
 */
export async function deleteUser(formData: FormData): Promise<ActionResult> {
  const admin = await assertAdmin();

  const parsed = DeleteSchema.safeParse({
    userId: formData.get("userId")?.toString() ?? "",
    confirm: formData.get("confirm")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Type the account's email to confirm." };
  }

  const { userId, confirm } = parsed.data;

  if (userId === admin.id) {
    return { ok: false, error: "You cannot delete your own account here." };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      isAdmin: true,
      _count: { select: { meals: true, workouts: true, payments: true } },
    },
  });
  if (!user) return { ok: false, error: "No such account." };

  if (user.isAdmin || emailIsAdmin(user.email)) {
    return {
      ok: false,
      error: "Remove this account's admin access before deleting it.",
    };
  }

  // The account id stands in for an account with no email on file — an
  // abandoned OAuth sign-up, say — which would otherwise be undeletable.
  const expected = (user.email ?? userId).toLowerCase();
  if (expected !== confirm.toLowerCase()) {
    return {
      ok: false,
      error: user.email
        ? "That email does not match this account."
        : "That account id does not match.",
    };
  }

  await recordAudit({
    actor: admin,
    action: "user.delete",
    targetType: "user",
    targetId: userId,
    summary: `Deleted the account ${user.email ?? userId}`,
    meta: {
      meals: user._count.meals,
      workouts: user._count.workouts,
      payments: user._count.payments,
    },
  });

  await db.user.delete({ where: { id: userId } });

  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

const ClaimSchema = z.object({
  paymentId: z.string().min(1),
  email: z.string().trim().email("That is not an email address."),
});

/**
 * Attributes an unmatched payment to an account.
 *
 * Money taken through the razorpay.me page carries no account id, so it lands
 * as UNMATCHED and waits for somebody to say who paid it — the same job
 * `npm run payments -- claim` does, moved somewhere a support request can be
 * answered from. The entitlement it grants is computed by the same function
 * the webhook uses, so a claimed payment is worth exactly what it would have
 * been worth had it matched itself.
 */
export async function claimPayment(formData: FormData): Promise<ActionResult> {
  const admin = await assertAdmin();

  const parsed = ClaimSchema.safeParse({
    paymentId: formData.get("paymentId")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  const { paymentId, email } = parsed.data;

  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { ok: false, error: "No such payment." };
  if (payment.status === "APPLIED") {
    return { ok: false, error: "That payment has already been applied." };
  }
  if (!payment.term) {
    return {
      ok: false,
      error: `${inr(payment.amount)} is not one of our prices, so it grants nothing.`,
    };
  }

  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      plan: true,
      planTerm: true,
      planExpiresAt: true,
    },
  });
  if (!user) return { ok: false, error: `No account signed up as ${email}.` };

  const update = planUpdateFor(user, payment.term, payment.paidAt);

  await recordAudit({
    actor: admin,
    action: "payment.claim",
    targetType: "payment",
    targetId: paymentId,
    summary: `Attributed ${inr(payment.amount)} to ${user.email}`,
    meta: {
      userId: user.id,
      term: payment.term,
      amount: payment.amount,
      keptLifetime: !update,
    },
  });

  await db.$transaction([
    db.payment.update({
      where: { id: paymentId },
      data: { status: "APPLIED", userId: user.id },
    }),
    ...(update ? [db.user.update({ where: { id: user.id }, data: update })] : []),
  ]);

  refresh(`/admin/users/${user.id}`);
  return { ok: true, id: user.id };
}

/** Parks a payment that buys nothing — a test rupee, a duplicate, a tip. */
export async function ignorePayment(formData: FormData): Promise<ActionResult> {
  const admin = await assertAdmin();

  const paymentId = formData.get("paymentId")?.toString() ?? "";
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, amount: true, status: true },
  });
  if (!payment) return { ok: false, error: "No such payment." };
  if (payment.status === "APPLIED") {
    return {
      ok: false,
      error: "That payment granted access. Revoke the plan instead.",
    };
  }

  await recordAudit({
    actor: admin,
    action: "payment.ignore",
    targetType: "payment",
    targetId: paymentId,
    summary: `Marked ${inr(payment.amount)} as buying nothing`,
  });

  await db.payment.update({
    where: { id: paymentId },
    data: { status: "IGNORED" },
  });

  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

/** Puts a failed or stuck job back on the queue with its attempts reset. */
export async function retryJob(formData: FormData): Promise<ActionResult> {
  const admin = await assertAdmin();

  const jobId = formData.get("jobId")?.toString() ?? "";
  const job = await db.job.findUnique({
    where: { id: jobId },
    select: { id: true, kind: true, targetId: true, state: true },
  });
  if (!job) return { ok: false, error: "No such job." };

  await recordAudit({
    actor: admin,
    action: "job.retry",
    targetType: "job",
    targetId: jobId,
    summary: `Requeued a ${job.kind} job`,
    meta: { from: job.state, targetId: job.targetId },
  });

  await db.job.update({
    where: { id: jobId },
    data: {
      state: "QUEUED",
      attempts: 0,
      runAfter: new Date(),
      leaseUntil: null,
      lastError: null,
    },
  });

  // Run it now rather than waiting for the next sweep; the queue is still the
  // owner of the outcome, so a killed invocation changes nothing.
  after(() => runNow(jobId).catch(() => {}));

  refresh();
  return { ok: true };
}

/** Gives up on a job for good, without deleting the record it belongs to. */
export async function cancelJob(formData: FormData): Promise<ActionResult> {
  const admin = await assertAdmin();

  const jobId = formData.get("jobId")?.toString() ?? "";
  const job = await db.job.findUnique({
    where: { id: jobId },
    select: { kind: true, targetId: true, state: true },
  });
  if (!job) return { ok: false, error: "No such job." };

  await recordAudit({
    actor: admin,
    action: "job.cancel",
    targetType: "job",
    targetId: jobId,
    summary: `Cancelled a ${job.kind} job`,
    meta: { from: job.state, targetId: job.targetId },
  });

  await db.job.update({
    where: { id: jobId },
    data: {
      state: "FAILED",
      leaseUntil: null,
      lastError: "Cancelled from the admin console",
    },
  });

  refresh();
  return { ok: true };
}

/**
 * Drains the queue by hand.
 *
 * The same work the cron does, for when somebody is watching a backlog and
 * does not want to wait for the schedule. Deliberately smaller than the
 * worker's batch: this runs inside a request, and a pass that runs fewer jobs
 * is better than one the platform kills halfway.
 */
export async function drainQueue(_formData?: FormData): Promise<ActionResult> {
  const admin = await assertAdmin();

  const running = await inFlight();
  const room = Math.max(0, MAX_IN_FLIGHT - running);
  if (room === 0) {
    return {
      ok: false,
      error: `Already at the ${MAX_IN_FLIGHT}-job ceiling. Try again shortly.`,
    };
  }

  const jobs = await claim(Math.min(3, room));

  await recordAudit({
    actor: admin,
    action: "queue.drain",
    targetType: "queue",
    summary: `Ran ${jobs.length} queued job${jobs.length === 1 ? "" : "s"} by hand`,
  });

  for (const job of jobs) await runJob(job);

  refresh();
  return { ok: true };
}

/** Clears finished jobs, which the sweep does daily anyway. */
export async function purgeJobs(_formData?: FormData): Promise<ActionResult> {
  const admin = await assertAdmin();

  const count = await purgeFinished(0);

  await recordAudit({
    actor: admin,
    action: "queue.purge",
    targetType: "queue",
    summary: `Cleared ${count} finished job${count === 1 ? "" : "s"}`,
  });

  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

const RecordSchema = z.object({
  kind: z.enum(["meal", "workout"]),
  id: z.string().min(1),
});

/**
 * Re-runs the AI pipeline for one record, on the athlete's behalf.
 *
 * Not rate-limited the way the athlete's own reprocess is: this is the tool
 * for answering "my meal never came back", and the ceiling that matters —
 * the daily AI budget — still applies inside the job.
 */
export async function reprocessRecord(
  formData: FormData,
): Promise<ActionResult> {
  const admin = await assertAdmin();

  const parsed = RecordSchema.safeParse({
    kind: formData.get("kind")?.toString() ?? "",
    id: formData.get("id")?.toString() ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Invalid record." };

  const { kind, id } = parsed.data;

  const record =
    kind === "meal"
      ? await db.meal.findUnique({ where: { id }, select: { userId: true } })
      : await db.workout.findUnique({ where: { id }, select: { userId: true } });
  if (!record) return { ok: false, error: "No such record." };

  await recordAudit({
    actor: admin,
    action: "record.reprocess",
    targetType: kind,
    targetId: id,
    summary: `Re-ran analysis for a ${kind}`,
    meta: { userId: record.userId },
  });

  if (kind === "meal") {
    await db.meal.update({
      where: { id },
      data: { status: "PROCESSING", error: null },
    });
  } else {
    await db.workout.update({
      where: { id },
      data: { status: "PROCESSING", error: null },
    });
  }

  const jobId = await enqueue(
    kind === "meal" ? "MEAL_ANALYSIS" : "WORKOUT_PARSE",
    id,
    record.userId,
  );
  after(() => runNow(jobId).catch(() => {}));

  refresh();
  return { ok: true };
}

/** Removes a record outright — junk, a duplicate, or something reported. */
export async function deleteRecord(formData: FormData): Promise<ActionResult> {
  const admin = await assertAdmin();

  const parsed = RecordSchema.safeParse({
    kind: formData.get("kind")?.toString() ?? "",
    id: formData.get("id")?.toString() ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Invalid record." };

  const { kind, id } = parsed.data;

  const record =
    kind === "meal"
      ? await db.meal.findUnique({ where: { id }, select: { userId: true } })
      : await db.workout.findUnique({ where: { id }, select: { userId: true } });
  if (!record) return { ok: false, error: "No such record." };

  await recordAudit({
    actor: admin,
    action: "record.delete",
    targetType: kind,
    targetId: id,
    summary: `Deleted a ${kind}`,
    meta: { userId: record.userId },
  });

  if (kind === "meal") await db.meal.delete({ where: { id } });
  else await db.workout.delete({ where: { id } });

  refresh();
  return { ok: true };
}
