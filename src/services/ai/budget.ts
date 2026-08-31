import { db } from "@/lib/db";

import { UNITS_PER_USD } from "./pricing";

/**
 * A hard ceiling on what the OpenAI key can spend in a day.
 *
 * The per-user rate limits bound what one athlete can do; they do nothing
 * about ten thousand athletes each doing their allowance. At 60 AI logs per
 * user per day, ten thousand trial accounts is roughly 600,000 model calls —
 * and every new sign-up gets a trial, so "users" here means sign-ups, not
 * customers. The concurrency cap holds the rate down to something like $1,500
 * a day, but a throughput limit is not a budget: it caps how fast money leaves,
 * not how much.
 *
 * This is the budget. Past it, queued analysis is parked until the window rolls
 * over rather than being run or failed — the athlete's log is still recorded,
 * and gets its real estimate tomorrow. A day of delayed macros is recoverable;
 * a surprise five-figure invoice is not.
 *
 * The cost maths lives in `pricing.ts`, which imports nothing, so the AI
 * services can price a call without pulling a database client into their
 * import graph.
 */

/** Read at call time: env may be populated after this module loads. */
export function dailyBudgetUsd(): number {
  return Number(process.env.AI_DAILY_BUDGET_USD ?? 25);
}

function dailyBudgetUnits(): number {
  return Math.round(dailyBudgetUsd() * UNITS_PER_USD);
}

function todayKey(): string {
  return `ai-spend:${new Date().toISOString().slice(0, 10)}`;
}

/** What has been spent today, in units. */
export async function spentToday(): Promise<number> {
  const row = await db.rateLimit.findUnique({
    where: { key: todayKey() },
    select: { count: true },
  });
  return row?.count ?? 0;
}

export type Budget = {
  spentUnits: number;
  budgetUnits: number;
  spentUsd: number;
  budgetUsd: number;
  exhausted: boolean;
};

export async function budgetStatus(): Promise<Budget> {
  const spentUnits = await spentToday();
  const budgetUnits = dailyBudgetUnits();
  return {
    spentUnits,
    budgetUnits,
    spentUsd: spentUnits / UNITS_PER_USD,
    budgetUsd: dailyBudgetUsd(),
    exhausted: spentUnits >= budgetUnits,
  };
}

/**
 * Whether there is room to start another job.
 *
 * Checked before the call and charged after it, so a burst already in flight
 * can overshoot by at most `AI_MAX_IN_FLIGHT` jobs' worth — a few cents at the
 * default. Reserving up front instead would mean refunding every failure,
 * which is more moving parts than the overshoot is worth.
 *
 * Fails OPEN on a database error, matching the rate limiter: an unreachable
 * database must not silently disable the product.
 */
export async function hasBudget(): Promise<boolean> {
  try {
    return (await spentToday()) < dailyBudgetUnits();
  } catch {
    return true;
  }
}

/**
 * Records spend against today.
 *
 * Rides on the rate-limit table rather than one of its own: it is the same
 * shape — an integer counted inside a window with an expiry — and the worker's
 * existing sweep already clears it. Kept for a week so a spike is still
 * legible the next morning.
 */
export async function charge(units: number): Promise<void> {
  if (units <= 0) return;

  const expiresAt = new Date(Date.now() + 7 * 24 * 3600_000);

  try {
    await db.rateLimit.upsert({
      where: { key: todayKey() },
      create: { key: todayKey(), count: units, expiresAt },
      update: { count: { increment: units } },
    });
  } catch (err) {
    // Losing the accounting must not lose work that was already paid for.
    console.error("[ai] could not record spend", err);
  }
}

/** Thrown when the day's budget is gone. The job waits rather than failing. */
export class BudgetExhausted extends Error {
  constructor(status: Budget) {
    super(
      `Daily AI budget spent: $${status.spentUsd.toFixed(2)} of ` +
        `$${status.budgetUsd.toFixed(2)}. Raise AI_DAILY_BUDGET_USD to continue.`,
    );
    this.name = "BudgetExhausted";
  }
}
