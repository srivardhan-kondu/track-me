import { Prisma, type JobKind } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * A small durable queue on the database we already run.
 *
 * The previous design handed AI processing to `after()`, which keeps the
 * serverless invocation alive for the whole 10–25 seconds of a Whisper call
 * plus a vision call. Past `maxDuration` the platform kills it, and the record
 * stays on PROCESSING for ever with nothing to pick it up.
 *
 * Now the upload enqueues and returns. Two things drain the queue:
 *
 *   1. `after()` still runs the job immediately, so a normal upload finishes
 *      just as fast as it did before. It just no longer *owns* the outcome.
 *   2. A cron-driven worker sweeps whatever the fast path did not finish —
 *      killed invocations, rate-limited calls, jobs deferred by the
 *      concurrency cap.
 *
 * Claiming uses `FOR UPDATE SKIP LOCKED`, so any number of workers can drain
 * the queue at once without two of them running the same job.
 */

/** How long a claim is held before another worker may take the job. */
const LEASE_SECONDS = 120;

/** Ceiling on jobs one worker pass will run, to stay inside maxDuration. */
export const WORKER_BATCH = 5;

/**
 * How many AI jobs may be in flight across the whole deployment.
 *
 * This is the backpressure valve: past it, jobs wait in the queue instead of
 * being sent to OpenAI to be rejected. Size it to your OpenAI tier — the
 * default suits tier 1 (500 RPM / 30k TPM) with vision payloads.
 */
export const MAX_IN_FLIGHT = Number(process.env.AI_MAX_IN_FLIGHT ?? 20);

export type JobRow = {
  id: string;
  kind: JobKind;
  targetId: string;
  userId: string;
  payload: Prisma.JsonValue;
  attempts: number;
  maxAttempts: number;
};

/**
 * Queues a job, or resets an existing one for the same record.
 *
 * `@@unique([kind, targetId])` makes this idempotent: re-uploading or
 * reprocessing the same meal never creates a second job, so a retry cannot
 * double the AI spend.
 */
export async function enqueue(
  kind: JobKind,
  targetId: string,
  userId: string,
  payload: Prisma.InputJsonValue | null = null,
): Promise<string> {
  const job = await db.job.upsert({
    where: { kind_targetId: { kind, targetId } },
    create: {
      kind,
      targetId,
      userId,
      payload: payload ?? Prisma.DbNull,
    },
    update: {
      state: "QUEUED",
      attempts: 0,
      runAfter: new Date(),
      leaseUntil: null,
      lastError: null,
      payload: payload ?? Prisma.DbNull,
    },
    select: { id: true },
  });
  return job.id;
}

/**
 * Atomically claims up to `limit` runnable jobs.
 *
 * A job is runnable when it is QUEUED and due, or when it is RUNNING with an
 * expired lease — which means the worker holding it was killed. `SKIP LOCKED`
 * lets concurrent workers step over each other's rows rather than queue behind
 * them.
 */
export async function claim(limit = WORKER_BATCH): Promise<JobRow[]> {
  const leaseUntil = new Date(Date.now() + LEASE_SECONDS * 1000);

  return db.$queryRaw<JobRow[]>`
    UPDATE "Job" SET
      state = 'RUNNING',
      attempts = attempts + 1,
      "leaseUntil" = ${leaseUntil},
      "updatedAt" = NOW()
    WHERE id IN (
      SELECT id FROM "Job"
      WHERE (
        (state = 'QUEUED' AND "runAfter" <= NOW())
        OR (state = 'RUNNING' AND "leaseUntil" < NOW())
      )
      ORDER BY "runAfter" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, kind, "targetId", "userId", payload, attempts, "maxAttempts"
  `;
}

/** Claims one specific job, for the fast path that just enqueued it. */
export async function claimOne(jobId: string): Promise<JobRow | null> {
  const leaseUntil = new Date(Date.now() + LEASE_SECONDS * 1000);

  const rows = await db.$queryRaw<JobRow[]>`
    UPDATE "Job" SET
      state = 'RUNNING',
      attempts = attempts + 1,
      "leaseUntil" = ${leaseUntil},
      "updatedAt" = NOW()
    WHERE id IN (
      SELECT id FROM "Job"
      WHERE id = ${jobId}
        AND state = 'QUEUED'
        AND "runAfter" <= NOW()
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, kind, "targetId", "userId", payload, attempts, "maxAttempts"
  `;

  return rows[0] ?? null;
}

/** Number of jobs currently held under a live lease. */
export async function inFlight(): Promise<number> {
  return db.job.count({
    where: { state: "RUNNING", leaseUntil: { gt: new Date() } },
  });
}

export async function complete(jobId: string): Promise<void> {
  await db.job.update({
    where: { id: jobId },
    data: { state: "DONE", leaseUntil: null, lastError: null },
  });
}

/**
 * Records a failure, and either schedules a retry or gives up.
 *
 * Returns whether the job will be tried again, so the caller knows whether to
 * mark the underlying record FAILED — a record whose job is still going to
 * run must not show the athlete an error.
 */
export async function fail(
  job: Pick<JobRow, "id" | "attempts" | "maxAttempts">,
  err: unknown,
): Promise<{ willRetry: boolean }> {
  const message = (err as Error)?.message?.slice(0, 400) ?? "Unknown error";
  const willRetry = job.attempts < job.maxAttempts;

  if (!willRetry) {
    await db.job.update({
      where: { id: job.id },
      data: { state: "FAILED", leaseUntil: null, lastError: message },
    });
    return { willRetry: false };
  }

  // 30s, 2m, 8m — long enough for an OpenAI rate-limit window to reopen.
  const backoffMs = 30_000 * 4 ** (job.attempts - 1);

  await db.job.update({
    where: { id: job.id },
    data: {
      state: "QUEUED",
      leaseUntil: null,
      lastError: message,
      runAfter: new Date(Date.now() + backoffMs),
    },
  });

  return { willRetry: true };
}

/** Clears finished jobs so the table stays small. */
export async function purgeFinished(olderThanHours = 24): Promise<number> {
  const { count } = await db.job.deleteMany({
    where: {
      state: "DONE",
      updatedAt: { lt: new Date(Date.now() - olderThanHours * 3600_000) },
    },
  });
  return count;
}
