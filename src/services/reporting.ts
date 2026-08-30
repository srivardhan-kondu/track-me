import { db } from "@/lib/db";
import { dayKey, endOfDayLocal, round, startOfDayLocal } from "@/lib/utils";

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
): Promise<TimelineEntry[]> {
  const from = startOfDayLocal(date);
  const to = endOfDayLocal(date);

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
      where: { userId, day: dayKey(date) },
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
};

export async function getDayTotals(
  userId: string,
  date: Date,
): Promise<DayTotals> {
  const from = startOfDayLocal(date);
  const to = endOfDayLocal(date);

  const [agg, workoutCount] = await Promise.all([
    db.meal.aggregate({
      where: { userId, eatenAt: { gte: from, lte: to } },
      _sum: { calories: true, protein: true, carbs: true, fat: true },
      _count: true,
    }),
    db.workout.count({
      where: { userId, performedAt: { gte: from, lte: to } },
    }),
  ]);

  return {
    calories: round(agg._sum.calories ?? 0) ?? 0,
    protein: round(agg._sum.protein ?? 0) ?? 0,
    carbs: round(agg._sum.carbs ?? 0) ?? 0,
    fat: round(agg._sum.fat ?? 0) ?? 0,
    mealCount: agg._count,
    workoutCount,
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
  daysElapsed: number;
  weightChangeKg: number | null;
  startWeightKg: number | null;
  endWeightKg: number | null;
};

/** Aggregates the last `days` days (default 7) into a coach-facing summary. */
export async function getSummary(
  userId: string,
  days = 7,
): Promise<WeeklySummary> {
  const to = endOfDayLocal(new Date());
  const from = startOfDayLocal(
    new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000),
  );

  const [meals, workoutCount, weights] = await Promise.all([
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
      where: { userId, day: { gte: dayKey(from), lte: dayKey(to) } },
      orderBy: { day: "asc" },
      select: { weightKg: true, day: true },
    }),
  ]);

  const loggedDays = new Set(
    meals.map((m) => startOfDayLocal(m.eatenAt).toISOString()),
  );

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
): Promise<WeightPoint[]> {
  const from = dayKey(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
  const rows = await db.weightEntry.findMany({
    where: { userId, day: { gte: from } },
    orderBy: { day: "asc" },
    select: { day: true, weightKg: true },
  });
  return rows;
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
): Promise<ComplianceDay[]> {
  const from = startOfDayLocal(
    new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000),
  );
  const to = endOfDayLocal(new Date());

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
      where: { userId, day: { gte: dayKey(from), lte: dayKey(to) } },
      select: { day: true },
    }),
  ]);

  const bucket = new Map<string, ComplianceDay>();
  for (let i = 0; i < days; i++) {
    const d = startOfDayLocal(
      new Date(from.getTime() + i * 24 * 60 * 60 * 1000),
    );
    bucket.set(d.toDateString(), {
      day: d,
      meals: 0,
      workouts: 0,
      weighedIn: false,
    });
  }

  for (const m of meals) {
    const k = startOfDayLocal(m.eatenAt).toDateString();
    const b = bucket.get(k);
    if (b) b.meals += 1;
  }
  for (const w of workouts) {
    const k = startOfDayLocal(w.performedAt).toDateString();
    const b = bucket.get(k);
    if (b) b.workouts += 1;
  }
  for (const w of weights) {
    // `day` is a date-only column, so read it in UTC to avoid a timezone shift.
    const d = new Date(w.day);
    const k = new Date(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
    ).toDateString();
    const b = bucket.get(k);
    if (b) b.weighedIn = true;
  }

  return [...bucket.values()];
}

/** Roster rows for the coach dashboard. */
export async function getCoachRoster(coachId: string) {
  const links = await db.coachAthlete.findMany({
    where: { coachId },
    orderBy: { createdAt: "asc" },
    include: {
      athlete: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  return Promise.all(
    links.map(async (link) => {
      const [summary, todayTotals, lastMeal] = await Promise.all([
        getSummary(link.athlete.id, 7),
        getDayTotals(link.athlete.id, new Date()),
        db.meal.findFirst({
          where: { userId: link.athlete.id },
          orderBy: { eatenAt: "desc" },
          select: { eatenAt: true },
        }),
      ]);

      return {
        athlete: link.athlete,
        summary,
        todayTotals,
        lastLoggedAt: lastMeal?.eatenAt ?? null,
      };
    }),
  );
}
