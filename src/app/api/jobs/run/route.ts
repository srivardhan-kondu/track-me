import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { claim, inFlight, MAX_IN_FLIGHT, purgeFinished, WORKER_BATCH } from "@/lib/jobs";
import { purgeExpired } from "@/lib/rate-limit";
import { budgetStatus } from "@/services/ai/budget";
import { runJob } from "@/services/processing";

/**
 * Drains the AI job queue.
 *
 * Everything an upload could not finish itself ends up here: invocations the
 * platform killed mid-flight, calls OpenAI rate-limited, jobs deferred because
 * the deployment was already at its concurrency ceiling. Without this the
 * records those jobs belong to would sit on PROCESSING for ever.
 *
 * Driven by Vercel Cron (see vercel.json). Also safe to call by hand while
 * debugging, given the secret.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Jobs are claimed under a lease, so anything this misses is simply picked up
// on the next pass rather than lost.
export const maxDuration = 60;

/** Constant-time, so the secret cannot be found one character at a time. */
function secretMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return Boolean(token) && secretMatches(token, secret);
}

async function drain() {
  // Respect the same ceiling the upload path does, so a cron pass cannot be
  // the thing that blows the OpenAI quota.
  const running = await inFlight();
  const room = Math.max(0, MAX_IN_FLIGHT - running);
  if (room === 0) {
    return { claimed: 0, done: 0, retrying: 0, failed: 0, deferred: true };
  }

  const jobs = await claim(Math.min(WORKER_BATCH, room));
  const tally = { done: 0, retrying: 0, failed: 0 };

  // Serially: these are the calls the concurrency cap exists to meter, and one
  // pass finishing fewer jobs is better than a pass that trips the quota.
  for (const job of jobs) {
    const outcome = await runJob(job);
    tally[outcome] += 1;
  }

  return { claimed: jobs.length, ...tally, deferred: false };
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await drain();

  // Housekeeping rides along with the queue pass rather than needing a
  // schedule of its own. Neither is worth failing the request over.
  const [purgedJobs, purgedWindows, budget] = await Promise.all([
    purgeFinished().catch(() => 0),
    purgeExpired().catch(() => 0),
    budgetStatus().catch(() => null),
  ]);

  return NextResponse.json(
    {
      ...result,
      purgedJobs,
      purgedWindows,
      // The single number worth watching: what the OpenAI key spent today.
      budget: budget && {
        spentUsd: Number(budget.spentUsd.toFixed(3)),
        budgetUsd: budget.budgetUsd,
        exhausted: budget.exhausted,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Cron sends GET; POST is here for calling it by hand. */
export const POST = GET;
