import { db } from "@/lib/db";
import {
  addDaysInZone,
  dayKeyInZone,
  endOfDayInZone,
  safeZone,
  startOfDayInZone,
  toDateParam,
} from "@/lib/tz";
import { round } from "@/lib/utils";

export type TimelineEntry =
  | { kind: "meal"; at: Date; id: string; data: TimelineMeal }
  | { kind: "workout"; at: Date; id: string; data: TimelineWorkout }
  | { kind: "weight"; at: Date; id: string; data: TimelineWeight };

export type TimelineMeal = {
  id: string;
  title: string | null;
  slot: string | null;
  transcript: string | null;
  imageKey: string | null;
  audioKey: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  items: unknown;
  aiGenerated: boolean | null;
  status: string;
  error: string | null;
  eatenAt: Date;
  comments: TimelineComment[];
};

export type TimelineWorkout = {
  id: string;
  title: string | null;
  audioKey: string | null;
  transcript: string | null;
  durationMin: number | null;
  notes: string | null;
  aiGenerated: boolean | null;
  status: string;
  error: string | null;
  performedAt: Date;
  exercises: {
    id: string;
    name: string;
    weightKg: number | null;
    sets: number | null;
    reps: number | null;
  }[];
  comments: TimelineComment[];
};

export type TimelineWeight = {
  id: string;
  weightKg: number;
  notes: string | null;
  photoKey: string | null;
  day: Date;
  comments: TimelineComment[];
};

export type TimelineComment = {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string | null; image: string | null };
};

const commentInclude = {
  orderBy: { createdAt: "asc" },
  include: {
    author: { select: { id: true, name: true, image: true } },
  },
} as const;

/** Everything an athlete logged on one calendar day, in chronological order. */
export async function getDayTimeline(
  userId: string,
  date: Date,
  timeZone: string,
): Promise<TimelineEntry[]> {
  const zone = safeZone(timeZone);
  const from = startOfDayInZone(date, zone);
  const to = endOfDayInZone(date, zone);

  const [meals, workouts, weight] = await Promise.all([
    db.meal.findMany({
      where: { userId, eatenAt: { gte: from, lte: to } },
      orderBy: { eatenAt: "asc" },
      include: { comments: commentInclude },
    }),
    db.workout.findMany({
      where: { userId, performedAt: { gte: from, lte: to } },
      orderBy: { performedAt: "asc" },
      include: {
        exercises: { orderBy: { position: "asc" } },
        comments: commentInclude,
      },
    }),
    db.weightEntry.findFirst({
      where: { userId, day: dayKeyInZone(date, zone) },
      include: { comments: commentInclude },
    }),
  ]);

  const entries: TimelineEntry[] = [];

  if (weight) {
    entries.push({
      kind: "weight",
      // Weigh-ins are a morning check-in, so they head the day.
      at: from,
      id: weight.id,
      data: weight as TimelineWeight,
    });
  }

  for (const m of meals) {
    entries.push({
      kind: "meal",
      at: m.eatenAt,
      id: m.id,
      data: m as TimelineMeal,
    });
  }

  for (const w of workouts) {
    entries.push({
      kind: "workout",
      at: w.performedAt,
      id: w.id,
      data: w as TimelineWorkout,
    });
  }

  return entries.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export type DayTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount: number;
  workoutCount: number;
  /** Millilitres of water logged on the day. */
  waterMl: number;
};

export async function getDayTotals(
  userId: string,
  date: Date,
  timeZone: string,
): Promise<DayTotals> {
  const zone = safeZone(timeZone);
  const from = startOfDayInZone(date, zone);
  const to = endOfDayInZone(date, zone);

  const [agg, workoutCount, water] = await Promise.all([
    db.meal.aggregate({
      where: { userId, eatenAt: { gte: from, lte: to } },
      _sum: { calories: true, protein: true, carbs: true, fat: true },
      _count: true,
    }),
    db.workout.count({
      where: { userId, performedAt: { gte: from, lte: to } },
    }),
    // Water is bucketed by calendar date, not by instant, so it is looked up
    // by the same day key the entry was written under.
    db.waterEntry.findUnique({
      where: { userId_day: { userId, day: dayKeyInZone(date, zone) } },
      select: { ml: true },
    }),
  ]);

  return {
    calories: round(agg._sum.calories ?? 0) ?? 0,
    protein: round(agg._sum.protein ?? 0) ?? 0,
    carbs: round(agg._sum.carbs ?? 0) ?? 0,
    fat: round(agg._sum.fat ?? 0) ?? 0,
    mealCount: agg._count,
    workoutCount,
    waterMl: water?.ml ?? 0,
  };
}

export type WeeklySummary = {
  from: Date;
  to: Date;
  avgCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  totalMeals: number;
  totalWorkouts: number;
  /** Days with at least one meal logged, out of the days elapsed. */
  mealComplianceDays: number;
  weighInDays: number;
  /** Days with any water logged, and the mean over those days alone. */
  waterDays: number;
  avgWaterMl: number;
  daysElapsed: number;
  weightChangeKg: number | null;
  startWeightKg: number | null;
  endWeightKg: number | null;
};

/** Aggregates the last `days` days (default 7) into a coach-facing summary. */
export async function getSummary(
  userId: string,
  days = 7,
  timeZone = "UTC",
): Promise<WeeklySummary> {
  const zone = safeZone(timeZone);
  const now = new Date();
  const to = endOfDayInZone(now, zone);
  const from = startOfDayInZone(addDaysInZone(now, -(days - 1), zone), zone);

  const [meals, workoutCount, weights, water] = await Promise.all([
    db.meal.findMany({
      where: { userId, eatenAt: { gte: from, lte: to } },
      select: {
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
        eatenAt: true,
      },
    }),
    db.workout.count({
      where: { userId, performedAt: { gte: from, lte: to } },
    }),
    db.weightEntry.findMany({
      where: {
        userId,
        day: { gte: dayKeyInZone(from, zone), lte: dayKeyInZone(to, zone) },
      },
      orderBy: { day: "asc" },
      select: { weightKg: true, day: true },
    }),
    db.waterEntry.findMany({
      where: {
        userId,
        day: { gte: dayKeyInZone(from, zone), lte: dayKeyInZone(to, zone) },
      },
      select: { ml: true },
    }),
  ]);

  const loggedDays = new Set(meals.map((m) => toDateParam(m.eatenAt, zone)));

  const sum = (pick: (m: (typeof meals)[number]) => number | null) =>
    meals.reduce((acc, m) => acc + (pick(m) ?? 0), 0);

  // Average across days the athlete actually logged, so a missed day does not
  // read as a starvation day.
  const divisor = Math.max(1, loggedDays.size);

  const startWeight = weights[0]?.weightKg ?? null;
  const endWeight = weights[weights.length - 1]?.weightKg ?? null;

  return {
    from,
    to,
    avgCalories: round(sum((m) => m.calories) / divisor) ?? 0,
    avgProtein: round(sum((m) => m.protein) / divisor) ?? 0,
    avgCarbs: round(sum((m) => m.carbs) / divisor) ?? 0,
    avgFat: round(sum((m) => m.fat) / divisor) ?? 0,
    totalMeals: meals.length,
    totalWorkouts: workoutCount,
    mealComplianceDays: loggedDays.size,
    weighInDays: weights.length,
    waterDays: water.length,
    // Averaged over the days water was actually logged, for the same reason
    // the macros are: a day nobody logged is not a day nobody drank.
    avgWaterMl: water.length
      ? Math.round(water.reduce((a, w) => a + w.ml, 0) / water.length)
      : 0,
    daysElapsed: days,
    weightChangeKg:
      startWeight !== null && endWeight !== null && weights.length > 1
        ? round(endWeight - startWeight, 1)
        : null,
    startWeightKg: startWeight,
    endWeightKg: endWeight,
  };
}

export type WeightPoint = { day: Date; weightKg: number };

export async function getWeightSeries(
  userId: string,
  days = 90,
  timeZone = "UTC",
): Promise<WeightPoint[]> {
  const zone = safeZone(timeZone);
  const from = dayKeyInZone(addDaysInZone(new Date(), -days, zone), zone);
  const rows = await db.weightEntry.findMany({
    where: { userId, day: { gte: from } },
    orderBy: { day: "asc" },
    select: { day: true, weightKg: true },
  });
  return rows;
}

export type WaterPoint = { day: Date; ml: number };

/** Daily hydration totals for the chart, oldest first. */
export async function getWaterSeries(
  userId: string,
  days = 30,
  timeZone = "UTC",
): Promise<WaterPoint[]> {
  const zone = safeZone(timeZone);
  const from = dayKeyInZone(addDaysInZone(new Date(), -days, zone), zone);
  return db.waterEntry.findMany({
    where: { userId, day: { gte: from } },
    orderBy: { day: "asc" },
    select: { day: true, ml: true },
  });
}

export type CoachNote = {
  body: string;
  createdAt: Date;
  author: { name: string | null; image: string | null };
};

/**
 * The most recent comment left on this athlete's logs by anyone else, so the
 * dashboard can surface it instead of burying it inside one timeline card.
 */
export async function getLatestCoachNote(
  userId: string,
): Promise<CoachNote | null> {
  const note = await db.comment.findFirst({
    where: {
      authorId: { not: userId },
      OR: [
        { meal: { userId } },
        { workout: { userId } },
        { weightEntry: { userId } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      body: true,
      createdAt: true,
      author: { select: { name: true, image: true } },
    },
  });

  return note;
}

export type ComplianceDay = {
  day: Date;
  meals: number;
  workouts: number;
  weighedIn: boolean;
};

/** Per-day logging activity for the compliance strip. */
export async function getCompliance(
  userId: string,
  days = 14,
  timeZone = "UTC",
): Promise<ComplianceDay[]> {
  const zone = safeZone(timeZone);
  const now = new Date();
  const from = startOfDayInZone(addDaysInZone(now, -(days - 1), zone), zone);
  const to = endOfDayInZone(now, zone);

  const [meals, workouts, weights] = await Promise.all([
    db.meal.findMany({
      where: { userId, eatenAt: { gte: from, lte: to } },
      select: { eatenAt: true },
    }),
    db.workout.findMany({
      where: { userId, performedAt: { gte: from, lte: to } },
      select: { performedAt: true },
    }),
    db.weightEntry.findMany({
      where: {
        userId,
        day: { gte: dayKeyInZone(from, zone), lte: dayKeyInZone(to, zone) },
      },
      select: { day: true },
    }),
  ]);

  // Keyed by local calendar date so every bucket is the athlete's own day.
  const bucket = new Map<string, ComplianceDay>();
  for (let i = 0; i < days; i++) {
    const d = addDaysInZone(from, i, zone);
    bucket.set(toDateParam(d, zone), {
      day: d,
      meals: 0,
      workouts: 0,
      weighedIn: false,
    });
  }

  for (const m of meals) {
    const b = bucket.get(toDateParam(m.eatenAt, zone));
    if (b) b.meals += 1;
  }
  for (const w of workouts) {
    const b = bucket.get(toDateParam(w.performedAt, zone));
    if (b) b.workouts += 1;
  }
  for (const w of weights) {
    // `day` is a date-only column already stored as the local calendar date.
    const d = new Date(w.day);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const b = bucket.get(key);
    if (b) b.weighedIn = true;
  }

  return [...bucket.values()];
}

/** Roster rows for the coach dashboard. */
const ROSTER_DAYS = 7;

/**
 * The coach's roster, with each athlete's week and today at a glance.
 *
 * Batched deliberately. The obvious shape — map over the roster and call
 * `getSummary` and `getDayTotals` per athlete — costs six round trips each,
 * so a coach with fifty athletes issued over three hundred queries to render
 * one page, all fired at once against a connection pool holding one connection
 * per instance. This runs a fixed four queries regardless of roster size:
 * fetch the widest window any athlete needs, then bucket in memory against
 * each athlete's own timezone, which is what made the per-athlete queries look
 * necessary in the first place.
 */
export async function getCoachRoster(coachId: string) {
  const links = await db.coachAthlete.findMany({
    // Only accepted links. A pending request must not surface any of the
    // athlete's figures — that would leak exactly what acceptance gates.
    where: { coachId, status: "ACCEPTED" },
    orderBy: { createdAt: "asc" },
    include: {
      athlete: {
        select: { id: true, name: true, email: true, image: true, timeZone: true },
      },
    },
  });

  if (links.length === 0) return [];

  const now = new Date();

  // Each athlete's own windows, in their own zone.
  const windows = links.map((link) => {
    const zone = safeZone(link.athlete.timeZone);
    return {
      athlete: link.athlete,
      zone,
      weekFrom: startOfDayInZone(addDaysInZone(now, -(ROSTER_DAYS - 1), zone), zone),
      weekTo: endOfDayInZone(now, zone),
      dayFrom: startOfDayInZone(now, zone),
      dayTo: endOfDayInZone(now, zone),
    };
  });

  const userIds = windows.map((w) => w.athlete.id);
  // One span covering every athlete's window; zones differ by at most a day.
  const spanFrom = new Date(Math.min(...windows.map((w) => w.weekFrom.getTime())));
  const spanTo = new Date(Math.max(...windows.map((w) => w.weekTo.getTime())));

  const [meals, workouts, weights, water, lastMeals] = await Promise.all([
    db.meal.findMany({
      where: { userId: { in: userIds }, eatenAt: { gte: spanFrom, lte: spanTo } },
      select: {
        userId: true,
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
        eatenAt: true,
      },
    }),
    db.workout.findMany({
      where: {
        userId: { in: userIds },
        performedAt: { gte: spanFrom, lte: spanTo },
      },
      select: { userId: true, performedAt: true },
    }),
    db.weightEntry.findMany({
      where: {
        userId: { in: userIds },
        day: {
          gte: dayKeyInZone(spanFrom, "UTC"),
          lte: dayKeyInZone(spanTo, "UTC"),
        },
      },
      orderBy: { day: "asc" },
      select: { userId: true, weightKg: true, day: true },
    }),
    db.waterEntry.findMany({
      where: {
        userId: { in: userIds },
        day: {
          gte: dayKeyInZone(spanFrom, "UTC"),
          lte: dayKeyInZone(spanTo, "UTC"),
        },
      },
      orderBy: { day: "asc" },
      select: { userId: true, ml: true, day: true },
    }),
    // The most recent meal per athlete, for "logged 3h ago". One grouped
    // aggregate rather than a findFirst each.
    db.meal.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _max: { eatenAt: true },
    }),
  ]);

  const by = <T extends { userId: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const list = map.get(row.userId);
      if (list) list.push(row);
      else map.set(row.userId, [row]);
    }
    return map;
  };

  const mealsBy = by(meals);
  const workoutsBy = by(workouts);
  const weightsBy = by(weights);
  const waterBy = by(water);
  const lastLoggedBy = new Map(
    lastMeals.map((row) => [row.userId, row._max.eatenAt ?? null]),
  );

  return windows.map((w) => {
    const inWeek = (mealsBy.get(w.athlete.id) ?? []).filter(
      (m) => m.eatenAt >= w.weekFrom && m.eatenAt <= w.weekTo,
    );
    const dayMeals = inWeek.filter(
      (m) => m.eatenAt >= w.dayFrom && m.eatenAt <= w.dayTo,
    );
    const athleteWorkouts = workoutsBy.get(w.athlete.id) ?? [];
    const weekWorkouts = athleteWorkouts.filter(
      (x) => x.performedAt >= w.weekFrom && x.performedAt <= w.weekTo,
    );
    const dayWorkouts = athleteWorkouts.filter(
      (x) => x.performedAt >= w.dayFrom && x.performedAt <= w.dayTo,
    );

    const weekWeights = (weightsBy.get(w.athlete.id) ?? []).filter(
      (x) =>
        x.day >= dayKeyInZone(w.weekFrom, w.zone) &&
        x.day <= dayKeyInZone(w.weekTo, w.zone),
    );

    const weekWater = (waterBy.get(w.athlete.id) ?? []).filter(
      (x) =>
        x.day >= dayKeyInZone(w.weekFrom, w.zone) &&
        x.day <= dayKeyInZone(w.weekTo, w.zone),
    );
    const todayWater = weekWater.find(
      (x) => x.day.getTime() === dayKeyInZone(w.dayFrom, w.zone).getTime(),
    );

    const loggedDays = new Set(inWeek.map((m) => toDateParam(m.eatenAt, w.zone)));
    const sum = (pick: (m: (typeof inWeek)[number]) => number | null) =>
      inWeek.reduce((acc, m) => acc + (pick(m) ?? 0), 0);
    // Average across days actually logged, so a missed day does not read as a
    // starvation day.
    const divisor = Math.max(1, loggedDays.size);

    const startWeight = weekWeights[0]?.weightKg ?? null;
    const endWeight = weekWeights[weekWeights.length - 1]?.weightKg ?? null;

    const summary: WeeklySummary = {
      from: w.weekFrom,
      to: w.weekTo,
      avgCalories: round(sum((m) => m.calories) / divisor) ?? 0,
      avgProtein: round(sum((m) => m.protein) / divisor) ?? 0,
      avgCarbs: round(sum((m) => m.carbs) / divisor) ?? 0,
      avgFat: round(sum((m) => m.fat) / divisor) ?? 0,
      totalMeals: inWeek.length,
      totalWorkouts: weekWorkouts.length,
      mealComplianceDays: loggedDays.size,
      weighInDays: weekWeights.length,
      waterDays: weekWater.length,
      avgWaterMl: weekWater.length
        ? Math.round(weekWater.reduce((a, x) => a + x.ml, 0) / weekWater.length)
        : 0,
      daysElapsed: ROSTER_DAYS,
      weightChangeKg:
        startWeight !== null && endWeight !== null && weekWeights.length > 1
          ? round(endWeight - startWeight, 1)
          : null,
      startWeightKg: startWeight,
      endWeightKg: endWeight,
    };

    const todayTotals: DayTotals = {
      calories: round(dayMeals.reduce((a, m) => a + (m.calories ?? 0), 0)) ?? 0,
      protein: round(dayMeals.reduce((a, m) => a + (m.protein ?? 0), 0)) ?? 0,
      carbs: round(dayMeals.reduce((a, m) => a + (m.carbs ?? 0), 0)) ?? 0,
      fat: round(dayMeals.reduce((a, m) => a + (m.fat ?? 0), 0)) ?? 0,
      mealCount: dayMeals.length,
      workoutCount: dayWorkouts.length,
      waterMl: todayWater?.ml ?? 0,
    };

    return {
      athlete: w.athlete,
      summary,
      todayTotals,
      lastLoggedAt: lastLoggedBy.get(w.athlete.id) ?? null,
    };
  });
}

/** Requests this coach has sent that the athlete has not answered yet. */
export async function getPendingRequests(coachId: string) {
  return db.coachAthlete.findMany({
    where: { coachId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      athlete: { select: { id: true, name: true, email: true, image: true } },
    },
  });
}

/** Coaches asking to monitor this athlete, and those already accepted. */
export async function getCoachLinksForAthlete(athleteId: string) {
  const links = await db.coachAthlete.findMany({
    where: { athleteId, status: { in: ["PENDING", "ACCEPTED"] } },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      createdAt: true,
      coach: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return {
    pending: links.filter((l) => l.status === "PENDING"),
    accepted: links.filter((l) => l.status === "ACCEPTED"),
  };
}

export type WeekFigures = {
  workouts: number;
  /** Tonnage: weight × sets × reps, summed over every logged exercise. */
  volumeKg: number;
  calories: number;
  /** Mean logged session length, over the sessions that recorded one. */
  avgMinutes: number;
};

/**
 * The four figures on the dashboard hero strip.
 *
 * Tonnage only counts exercises that recorded all three of weight, sets and
 * reps — a voice-logged "some squats" contributes nothing rather than a zero
 * that would drag the number down silently.
 */
export async function getWeekFigures(
  userId: string,
  days = 7,
  timeZone = "UTC",
): Promise<WeekFigures> {
  const zone = safeZone(timeZone);
  const now = new Date();
  const from = startOfDayInZone(addDaysInZone(now, -(days - 1), zone), zone);
  const to = endOfDayInZone(now, zone);

  const [workouts, meals] = await Promise.all([
    db.workout.findMany({
      where: { userId, performedAt: { gte: from, lte: to } },
      select: {
        durationMin: true,
        exercises: { select: { weightKg: true, sets: true, reps: true } },
      },
    }),
    db.meal.aggregate({
      where: { userId, eatenAt: { gte: from, lte: to } },
      _sum: { calories: true },
    }),
  ]);

  let volumeKg = 0;
  for (const workout of workouts) {
    for (const e of workout.exercises) {
      if (e.weightKg && e.sets && e.reps) {
        volumeKg += e.weightKg * e.sets * e.reps;
      }
    }
  }

  const timed = workouts.filter((w) => w.durationMin && w.durationMin > 0);
  const avgMinutes = timed.length
    ? Math.round(
        timed.reduce((sum, w) => sum + (w.durationMin ?? 0), 0) / timed.length,
      )
    : 0;

  return {
    workouts: workouts.length,
    volumeKg: Math.round(volumeKg),
    calories: Math.round(meals._sum.calories ?? 0),
    avgMinutes,
  };
}
