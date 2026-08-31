import { Prisma, type JobState, type PaymentStatus, type Role } from "@prisma/client";
import { subDays } from "date-fns";

import {
  accountState,
  monthlyValuePaise,
  paginate,
  spendDay,
  type AccountState,
  type Page,
} from "@/lib/admin";
import { db } from "@/lib/db";
import { type PlanTerm } from "@/lib/entitlements";
import { budgetStatus } from "@/services/ai/budget";
import { UNITS_PER_USD } from "@/services/ai/pricing";

/**
 * Everything the admin console reads, and the audit trail it writes.
 *
 * The console answers three questions and nothing else: is the system healthy,
 * is the business working, and what happened to this one account. Each query
 * here belongs to one of those, and none of them is allowed to be the kind of
 * unbounded scan that is fine on a seeded database and fatal on a real one —
 * lists are paged, counts are counts rather than fetched rows, and per-day
 * series are aggregated in Postgres rather than in JavaScript.
 *
 * Day boundaries are the server's, which is UTC in production. That is stated
 * on the pages that show a "today" figure, because an admin in India reading
 * it at 2am would otherwise reasonably assume it meant their day.
 */

/**
 * How long a record may sit on PENDING or PROCESSING before it counts as
 * stalled. The queue's lease is two minutes, and the sweep that reclaims
 * expired leases runs on a schedule — a quarter of an hour is comfortably past
 * both, so anything older has genuinely lost its worker.
 */
const STALLED_AFTER_MIN = 15;

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export type AuditInput = {
  actor: { id: string; email: string | null };
  /** Stable verb: "user.plan.grant", "payment.claim", "job.retry". */
  action: string;
  targetType?: string;
  targetId?: string;
  summary: string;
  meta?: Prisma.InputJsonValue;
};

/**
 * Records an admin action.
 *
 * Called *before* the change it describes, so an action that fails halfway
 * still leaves a trace of having been attempted. A failure to write the audit
 * line is not allowed to fail the action itself — losing the note is bad,
 * losing the ability to fix a customer's account is worse — but it is loud.
 */
export async function recordAudit(entry: AuditInput): Promise<void> {
  try {
    await db.adminAudit.create({
      data: {
        actorId: entry.actor.id,
        actorEmail: entry.actor.email,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        summary: entry.summary,
        meta: entry.meta ?? Prisma.DbNull,
      },
    });
  } catch (err) {
    console.error("[admin] could not write an audit entry", entry.action, err);
  }
}

export async function listAudit(params: {
  action?: string;
  actorId?: string;
  page?: number;
  perPage?: number;
}) {
  const perPage = params.perPage ?? 50;
  const where: Prisma.AdminAuditWhereInput = {
    ...(params.action ? { action: params.action } : {}),
    ...(params.actorId ? { actorId: params.actorId } : {}),
  };

  const total = await db.adminAudit.count({ where });
  const page = paginate(total, params.page ?? 1, perPage);

  const rows = await db.adminAudit.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: page.skip,
    take: perPage,
  });

  return { rows, page };
}

/** The distinct verbs actually present, for the filter row. */
export async function auditActions(): Promise<string[]> {
  const rows = await db.adminAudit.groupBy({
    by: ["action"],
    _count: { action: true },
    orderBy: { _count: { action: "desc" } },
    take: 24,
  });
  return rows.map((r) => r.action);
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export type Overview = Awaited<ReturnType<typeof getOverview>>;

/** Distinct accounts that logged anything since `since`. */
async function activeSince(since: Date): Promise<number> {
  // groupBy rather than findMany+distinct: this returns one row per user
  // instead of one per meal, which is the difference between a few hundred
  // rows and every record in the table.
  const [meals, workouts, weights] = await Promise.all([
    db.meal.groupBy({ by: ["userId"], where: { createdAt: { gte: since } } }),
    db.workout.groupBy({ by: ["userId"], where: { createdAt: { gte: since } } }),
    db.weightEntry.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since } },
    }),
  ]);

  const seen = new Set<string>();
  for (const row of [...meals, ...workouts, ...weights]) seen.add(row.userId);
  return seen.size;
}

export async function getOverview() {
  const now = new Date();
  const day = subDays(now, 1);
  const week = subDays(now, 7);
  const fortnight = subDays(now, 14);
  const month = subDays(now, 30);
  const twoMonths = subDays(now, 60);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const stalledBefore = new Date(now.getTime() - STALLED_AFTER_MIN * 60_000);

  /** Paid *now*: PREMIUM whose expiry has not passed (null = lifetime). */
  const livePaid: Prisma.UserWhereInput = {
    plan: "PREMIUM",
    OR: [{ planExpiresAt: null }, { planExpiresAt: { gt: now } }],
  };

  const [
    totalUsers,
    admins,
    coaches,
    new24h,
    new7d,
    prev7d,
    new30d,
    paid,
    trialing,
    lapsed,
    termCounts,
    revenueAll,
    revenue30,
    revenuePrev30,
    paymentCounts,
    active24h,
    active7d,
    mealsToday,
    workoutsToday,
    weighInsToday,
    meals7d,
    jobStates,
    oldestQueued,
    failedMeals,
    failedWorkouts,
    stuckMeals,
    stuckWorkouts,
    links,
    budget,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { isAdmin: true } }),
    db.user.count({ where: { role: "COACH" } }),
    db.user.count({ where: { createdAt: { gte: day } } }),
    db.user.count({ where: { createdAt: { gte: week } } }),
    db.user.count({ where: { createdAt: { gte: fortnight, lt: week } } }),
    db.user.count({ where: { createdAt: { gte: month } } }),
    db.user.count({ where: livePaid }),
    db.user.count({
      where: { NOT: livePaid, trialEndsAt: { gt: now } },
    }),
    db.user.count({
      where: { NOT: livePaid, trialEndsAt: { lte: now } },
    }),
    db.user.groupBy({ by: ["planTerm"], where: livePaid, _count: true }),
    db.payment.aggregate({
      where: { status: "APPLIED" },
      _sum: { amount: true },
      _count: true,
    }),
    db.payment.aggregate({
      where: { status: "APPLIED", paidAt: { gte: month } },
      _sum: { amount: true },
      _count: true,
    }),
    db.payment.aggregate({
      where: { status: "APPLIED", paidAt: { gte: twoMonths, lt: month } },
      _sum: { amount: true },
    }),
    db.payment.groupBy({ by: ["status"], _count: true }),
    activeSince(day),
    activeSince(week),
    db.meal.count({ where: { createdAt: { gte: startOfToday } } }),
    db.workout.count({ where: { createdAt: { gte: startOfToday } } }),
    db.weightEntry.count({ where: { createdAt: { gte: startOfToday } } }),
    db.meal.count({ where: { createdAt: { gte: week } } }),
    db.job.groupBy({ by: ["state"], _count: true }),
    db.job.findFirst({
      where: { state: "QUEUED" },
      orderBy: { runAfter: "asc" },
      select: { runAfter: true },
    }),
    db.meal.count({ where: { status: "FAILED", createdAt: { gte: week } } }),
    db.workout.count({ where: { status: "FAILED", createdAt: { gte: week } } }),
    // Anything still mid-flight a quarter of an hour after it was created has
    // lost its worker; the queue's own lease is two minutes.
    db.meal.count({
      where: {
        status: { in: ["PENDING", "PROCESSING"] },
        createdAt: { lt: stalledBefore },
      },
    }),
    db.workout.count({
      where: {
        status: { in: ["PENDING", "PROCESSING"] },
        createdAt: { lt: stalledBefore },
      },
    }),
    db.coachAthlete.groupBy({ by: ["status"], _count: true }),
    budgetStatus().catch(() => null),
  ]);

  const jobs = (state: JobState) =>
    jobStates.find((row) => row.state === state)?._count ?? 0;
  const payments = (status: PaymentStatus) =>
    paymentCounts.find((row) => row.status === status)?._count ?? 0;

  const mrrPaise = termCounts.reduce(
    (total, row) =>
      total + monthlyValuePaise(row.planTerm as PlanTerm | null) * row._count,
    0,
  );

  const link = (status: "PENDING" | "ACCEPTED" | "DECLINED") =>
    links.find((row) => row.status === status)?._count ?? 0;

  return {
    users: {
      total: totalUsers,
      admins,
      coaches,
      athletes: totalUsers - coaches,
      new24h,
      new7d,
      prev7d,
      new30d,
    },
    accounts: {
      paid,
      trialing,
      lapsed,
      free: Math.max(0, totalUsers - paid - trialing - lapsed),
      /** Paying accounts over accounts that have finished a trial. */
      conversion: paid + lapsed > 0 ? paid / (paid + lapsed) : 0,
    },
    revenue: {
      allTimePaise: revenueAll._sum.amount ?? 0,
      last30Paise: revenue30._sum.amount ?? 0,
      prev30Paise: revenuePrev30._sum.amount ?? 0,
      payments30: revenue30._count,
      mrrPaise,
      applied: payments("APPLIED"),
      unmatched: payments("UNMATCHED"),
      ignored: payments("IGNORED"),
    },
    activity: {
      active24h,
      active7d,
      mealsToday,
      workoutsToday,
      weighInsToday,
      meals7d,
    },
    queue: {
      queued: jobs("QUEUED"),
      running: jobs("RUNNING"),
      done: jobs("DONE"),
      failed: jobs("FAILED"),
      oldestQueuedSec: oldestQueued
        ? Math.max(0, (now.getTime() - oldestQueued.runAfter.getTime()) / 1000)
        : 0,
    },
    content: {
      failedMeals,
      failedWorkouts,
      stuck: stuckMeals + stuckWorkouts,
    },
    coaching: {
      accepted: link("ACCEPTED"),
      pending: link("PENDING"),
      declined: link("DECLINED"),
    },
    ai: budget,
  };
}

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

export type Point = { day: string; value: number };

/** Fills the gaps: a day nobody signed up is a zero, not a missing column. */
function densify(
  rows: { day: Date; value: number }[],
  days: number,
  end = new Date(),
): Point[] {
  const byDay = new Map(
    rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.value)]),
  );

  const out: Point[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = subDays(end, i).toISOString().slice(0, 10);
    out.push({ day: key, value: byDay.get(key) ?? 0 });
  }
  return out;
}

/** Sign-ups, revenue and records logged, per day, aggregated in Postgres. */
export async function getTrends(days = 30) {
  const since = subDays(new Date(), days - 1);
  since.setHours(0, 0, 0, 0);

  const [signups, revenue, logs] = await Promise.all([
    db.$queryRaw<{ day: Date; value: number }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS value
      FROM "User" WHERE "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1
    `,
    db.$queryRaw<{ day: Date; value: number }[]>`
      SELECT date_trunc('day', "paidAt") AS day, COALESCE(SUM(amount), 0)::int AS value
      FROM "Payment" WHERE status = 'APPLIED' AND "paidAt" >= ${since}
      GROUP BY 1 ORDER BY 1
    `,
    db.$queryRaw<{ day: Date; value: number }[]>`
      SELECT day, SUM(value)::int AS value FROM (
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS value
          FROM "Meal" WHERE "createdAt" >= ${since} GROUP BY 1
        UNION ALL
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS value
          FROM "Workout" WHERE "createdAt" >= ${since} GROUP BY 1
        UNION ALL
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS value
          FROM "WeightEntry" WHERE "createdAt" >= ${since} GROUP BY 1
      ) t GROUP BY day ORDER BY day
    `,
  ]);

  return {
    signups: densify(signups, days),
    revenue: densify(revenue, days),
    logs: densify(logs, days),
  };
}

/**
 * What the OpenAI key has spent, per day.
 *
 * The ledger lives in the rate-limit table under `ai-spend:<date>` keys, kept
 * for a week — see services/ai/budget.ts — so this is a prefix scan over a
 * handful of rows rather than a table of its own.
 */
export async function getSpendHistory(): Promise<Point[]> {
  const rows = await db.rateLimit.findMany({
    where: { key: { startsWith: "ai-spend:" } },
    select: { key: true, count: true },
  });

  const points = rows
    .map((row) => ({ day: spendDay(row.key), usd: row.count / UNITS_PER_USD }))
    .filter((p): p is { day: string; usd: number } => p.day !== null)
    .sort((a, b) => a.day.localeCompare(b.day));

  return points.map((p) => ({ day: p.day, value: p.usd }));
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type UserFilters = {
  q?: string;
  state?: AccountState;
  role?: Role;
  admin?: boolean;
  sort?: "recent" | "name" | "active" | "spend";
  page?: number;
  perPage?: number;
};

export type AdminUserRow = Awaited<
  ReturnType<typeof listUsers>
>["rows"][number];

export async function listUsers(filters: UserFilters) {
  const now = new Date();
  const perPage = filters.perPage ?? 25;

  const livePaid: Prisma.UserWhereInput = {
    plan: "PREMIUM",
    OR: [{ planExpiresAt: null }, { planExpiresAt: { gt: now } }],
  };

  const byState: Record<AccountState, Prisma.UserWhereInput> = {
    PAID: livePaid,
    TRIAL: { NOT: livePaid, trialEndsAt: { gt: now } },
    LAPSED: { NOT: livePaid, trialEndsAt: { lte: now } },
    FREE: { NOT: livePaid, trialEndsAt: null },
  };

  // Composed with AND rather than by spreading into one object: the search
  // clause and the PAID state clause both want the `OR` key, and spreading
  // would silently drop whichever was written first — a filtered search that
  // quietly ignores half of what was asked for.
  const clauses: Prisma.UserWhereInput[] = [];

  if (filters.q) {
    clauses.push({
      OR: [
        { email: { contains: filters.q, mode: "insensitive" } },
        { name: { contains: filters.q, mode: "insensitive" } },
        { id: filters.q },
      ],
    });
  }
  if (filters.state) clauses.push(byState[filters.state]);
  if (filters.role) clauses.push({ role: filters.role });
  if (filters.admin) clauses.push({ isAdmin: true });

  const where: Prisma.UserWhereInput =
    clauses.length > 0 ? { AND: clauses } : {};

  const orderBy: Prisma.UserOrderByWithRelationInput =
    filters.sort === "name"
      ? { name: "asc" }
      : filters.sort === "active"
        ? { meals: { _count: "desc" } }
        : filters.sort === "spend"
          ? { payments: { _count: "desc" } }
          : { createdAt: "desc" };

  const total = await db.user.count({ where });
  const page = paginate(total, filters.page ?? 1, perPage);

  const rows = await db.user.findMany({
    where,
    orderBy,
    skip: page.skip,
    take: perPage,
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      isAdmin: true,
      plan: true,
      planTerm: true,
      planExpiresAt: true,
      trialEndsAt: true,
      createdAt: true,
      timeZone: true,
      _count: {
        select: {
          meals: true,
          workouts: true,
          weightEntries: true,
          payments: true,
          athleteLinks: true,
          coachLinks: true,
        },
      },
    },
  });

  return {
    rows: rows.map((user) => ({ ...user, state: accountState(user, now) })),
    page,
  };
}

export type UserDetail = NonNullable<Awaited<ReturnType<typeof getUserDetail>>>;

/** Everything one account's page shows, in a single round of queries. */
export async function getUserDetail(id: string) {
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      isAdmin: true,
      plan: true,
      planTerm: true,
      planExpiresAt: true,
      trialEndsAt: true,
      gender: true,
      age: true,
      heightCm: true,
      weightUnit: true,
      heightUnit: true,
      volumeUnit: true,
      timeZone: true,
      onboardedAt: true,
      createdAt: true,
      _count: {
        select: {
          meals: true,
          workouts: true,
          weightEntries: true,
          progressPhotos: true,
          comments: true,
          payments: true,
          accounts: true,
          sessions: true,
        },
      },
    },
  });
  if (!user) return null;

  const [
    payments,
    lastMeal,
    lastWorkout,
    lastWeight,
    firstWeight,
    failed,
    jobs,
    coachLinks,
    athleteLinks,
    audit,
    spend,
  ] = await Promise.all([
    db.payment.findMany({
      where: { userId: id },
      orderBy: { paidAt: "desc" },
      take: 10,
    }),
    db.meal.findFirst({
      where: { userId: id },
      orderBy: { eatenAt: "desc" },
      select: { eatenAt: true, title: true, status: true },
    }),
    db.workout.findFirst({
      where: { userId: id },
      orderBy: { performedAt: "desc" },
      select: { performedAt: true, title: true, status: true },
    }),
    db.weightEntry.findFirst({
      where: { userId: id },
      orderBy: { day: "desc" },
      select: { day: true, weightKg: true },
    }),
    db.weightEntry.findFirst({
      where: { userId: id },
      orderBy: { day: "asc" },
      select: { weightKg: true, day: true },
    }),
    db.meal.count({ where: { userId: id, status: "FAILED" } }),
    db.job.findMany({
      where: { userId: id },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    // Coaches this athlete has let in.
    db.coachAthlete.findMany({
      where: { athleteId: id },
      include: { coach: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // Athletes this account coaches.
    db.coachAthlete.findMany({
      where: { coachId: id },
      include: { athlete: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.adminAudit.findMany({
      where: { targetType: "user", targetId: id },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    db.payment.aggregate({
      where: { userId: id, status: "APPLIED" },
      _sum: { amount: true },
    }),
  ]);

  const lastActiveAt = [
    lastMeal?.eatenAt ?? null,
    lastWorkout?.performedAt ?? null,
    lastWeight?.day ?? null,
  ]
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return {
    user: { ...user, state: accountState(user) },
    payments,
    lifetimeValuePaise: spend._sum.amount ?? 0,
    lastActiveAt,
    lastMeal,
    lastWorkout,
    lastWeight,
    firstWeight,
    failedMeals: failed,
    jobs,
    coachLinks,
    athleteLinks,
    audit,
  };
}

/** Resolves an email to an account, for attributing a payment by hand. */
export async function findUserByEmail(email: string) {
  return db.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      planTerm: true,
      planExpiresAt: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function listPayments(filters: {
  status?: PaymentStatus;
  q?: string;
  page?: number;
  perPage?: number;
}) {
  const perPage = filters.perPage ?? 25;

  const where: Prisma.PaymentWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q
      ? {
          OR: [
            { id: { contains: filters.q, mode: "insensitive" } },
            { email: { contains: filters.q, mode: "insensitive" } },
            { contact: { contains: filters.q, mode: "insensitive" } },
            { note: { contains: filters.q, mode: "insensitive" } },
            { orderId: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const total = await db.payment.count({ where });
  const page = paginate(total, filters.page ?? 1, perPage);

  const rows = await db.payment.findMany({
    where,
    orderBy: { paidAt: "desc" },
    skip: page.skip,
    take: perPage,
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      term: true,
      email: true,
      contact: true,
      note: true,
      orderId: true,
      event: true,
      paidAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return { rows, page };
}

/** Money in, split the three ways a payment can land. */
export async function getRevenueBreakdown() {
  const month = subDays(new Date(), 30);

  const [byStatus, byTerm, thisMonth, unmatched] = await Promise.all([
    db.payment.groupBy({
      by: ["status"],
      _sum: { amount: true },
      _count: true,
    }),
    db.payment.groupBy({
      by: ["term"],
      where: { status: "APPLIED" },
      _sum: { amount: true },
      _count: true,
    }),
    db.payment.aggregate({
      where: { status: "APPLIED", paidAt: { gte: month } },
      _sum: { amount: true },
      _count: true,
    }),
    db.payment.aggregate({
      where: { status: "UNMATCHED" },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return {
    byStatus,
    byTerm,
    last30Paise: thisMonth._sum.amount ?? 0,
    last30Count: thisMonth._count,
    /** Money taken that nobody has been credited for. */
    unmatchedPaise: unmatched._sum.amount ?? 0,
    unmatchedCount: unmatched._count,
  };
}

// ---------------------------------------------------------------------------
// Queue and content
// ---------------------------------------------------------------------------

export type QueueTallyRow = Awaited<ReturnType<typeof getQueueTally>>;

/**
 * Just the queue's counters.
 *
 * The overview's figures come from `getOverview`, which asks the database
 * about thirty questions. The queue page needs four of them, and running the
 * other twenty-six to draw one panel is the kind of waste that only shows up
 * once the tables are large.
 */
export async function getQueueTally() {
  const now = new Date();

  const [states, oldest] = await Promise.all([
    db.job.groupBy({ by: ["state"], _count: true }),
    db.job.findFirst({
      where: { state: "QUEUED" },
      orderBy: { runAfter: "asc" },
      select: { runAfter: true },
    }),
  ]);

  const count = (state: JobState) =>
    states.find((row) => row.state === state)?._count ?? 0;

  return {
    queued: count("QUEUED"),
    running: count("RUNNING"),
    done: count("DONE"),
    failed: count("FAILED"),
    oldestQueuedSec: oldest
      ? Math.max(0, (now.getTime() - oldest.runAfter.getTime()) / 1000)
      : 0,
  };
}

export async function listJobs(filters: {
  state?: JobState;
  page?: number;
  perPage?: number;
}) {
  const perPage = filters.perPage ?? 30;
  const where: Prisma.JobWhereInput = filters.state
    ? { state: filters.state }
    : {};

  const total = await db.job.count({ where });
  const page = paginate(total, filters.page ?? 1, perPage);

  const jobs = await db.job.findMany({
    where,
    // Most recently touched first. Trouble is not sorted to the top here —
    // the FAILED filter and the stalled-records panel above the table are
    // what surface it, and ordering by an enum would sort by its declaration
    // order rather than by anything an admin means.
    orderBy: { updatedAt: "desc" },
    skip: page.skip,
    take: perPage,
  });

  // Job carries a userId but no relation — the queue is deliberately not
  // joined to anything, so that a job outlives whatever it was queued for.
  // Resolving the owners is one extra query for the page, not one per row.
  const owners = await db.user.findMany({
    where: { id: { in: [...new Set(jobs.map((j) => j.userId))] } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(owners.map((o) => [o.id, o]));

  const rows = jobs.map((job) => ({ ...job, user: byId.get(job.userId) ?? null }));

  return { rows, page };
}

/**
 * Records whose processing never finished.
 *
 * These are the ones a user is actually staring at — a meal that has been
 * "analysing" since yesterday — so they are listed by record rather than by
 * job, and each one carries the account it belongs to.
 */
export async function getStalledRecords(minutes = STALLED_AFTER_MIN) {
  const cutoff = new Date(Date.now() - minutes * 60_000);
  const owner = { select: { id: true, name: true, email: true } };

  const [meals, workouts] = await Promise.all([
    db.meal.findMany({
      where: {
        OR: [
          { status: "FAILED" },
          { status: { in: ["PENDING", "PROCESSING"] }, createdAt: { lt: cutoff } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        title: true,
        status: true,
        error: true,
        createdAt: true,
        user: owner,
      },
    }),
    db.workout.findMany({
      where: {
        OR: [
          { status: "FAILED" },
          { status: { in: ["PENDING", "PROCESSING"] }, createdAt: { lt: cutoff } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        title: true,
        status: true,
        error: true,
        createdAt: true,
        user: owner,
      },
    }),
  ]);

  return [
    ...meals.map((m) => ({ kind: "meal" as const, ...m })),
    ...workouts.map((w) => ({ kind: "workout" as const, ...w })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

export type SystemStatus = Awaited<ReturnType<typeof getSystemStatus>>;

/** Row counts, so the shape of the data is visible without a psql session. */
export async function getTableSizes() {
  const [
    users,
    meals,
    workouts,
    exercises,
    weightEntries,
    progressPhotos,
    comments,
    payments,
    jobs,
    rateLimits,
    catalog,
    links,
    audit,
    sessions,
  ] = await Promise.all([
    db.user.count(),
    db.meal.count(),
    db.workout.count(),
    db.exercise.count(),
    db.weightEntry.count(),
    db.progressPhoto.count(),
    db.comment.count(),
    db.payment.count(),
    db.job.count(),
    db.rateLimit.count(),
    db.catalogExercise.count(),
    db.coachAthlete.count(),
    db.adminAudit.count(),
    db.session.count(),
  ]);

  return [
    { table: "User", rows: users },
    { table: "Meal", rows: meals },
    { table: "Workout", rows: workouts },
    { table: "Exercise", rows: exercises },
    { table: "WeightEntry", rows: weightEntries },
    { table: "ProgressPhoto", rows: progressPhotos },
    { table: "Comment", rows: comments },
    { table: "Payment", rows: payments },
    { table: "Job", rows: jobs },
    { table: "RateLimit", rows: rateLimits },
    { table: "CatalogExercise", rows: catalog },
    { table: "CoachAthlete", rows: links },
    { table: "AdminAudit", rows: audit },
    { table: "Session", rows: sessions },
  ];
}

/** Round-trip time to Postgres, measured rather than assumed. */
export async function dbLatencyMs(): Promise<number | null> {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return Date.now() - started;
  } catch {
    return null;
  }
}

export async function getSystemStatus() {
  const [latency, tables, budget, spend, rateLimitRows] = await Promise.all([
    dbLatencyMs(),
    getTableSizes(),
    budgetStatus().catch(() => null),
    getSpendHistory().catch(() => []),
    db.rateLimit.count({ where: { expiresAt: { gt: new Date() } } }),
  ]);

  return { latency, tables, budget, spend, rateLimitRows };
}
