/**
 * Builds the account a payment gateway's reviewers sign in to.
 *
 *   npm run seed:review
 *
 * Reads REVIEW_EMAIL from the environment, creates that account if it is
 * missing, and fills it with a fortnight of plausible training so the reviewer
 * sees a working product rather than an empty dashboard.
 *
 * The account is left on the free plan with an expired trial, deliberately:
 * what a reviewer needs to see is the paywall, the prices, and a checkout that
 * works — none of which is visible from inside a subscription.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const MEALS = [
  { title: "Oats, banana and whey", slot: "BREAKFAST", kcal: 520, p: 38, c: 72, f: 9 },
  { title: "Chicken rice bowl", slot: "LUNCH", kcal: 680, p: 52, c: 74, f: 16 },
  { title: "Paneer bhurji and roti", slot: "DINNER", kcal: 610, p: 34, c: 55, f: 27 },
  { title: "Greek yoghurt and almonds", slot: "SNACK", kcal: 240, p: 18, c: 14, f: 12 },
] as const;

const SESSIONS = [
  { title: "Push day", min: 62, moves: [["Bench press", 4, 8, 60], ["Overhead press", 3, 10, 35], ["Cable fly", 3, 12, 15]] },
  { title: "Pull day", min: 58, moves: [["Deadlift", 4, 5, 100], ["Barbell row", 4, 8, 60], ["Lat pulldown", 3, 12, 45]] },
  { title: "Leg day", min: 71, moves: [["Back squat", 5, 5, 90], ["Romanian deadlift", 3, 10, 70], ["Leg press", 3, 12, 140]] },
] as const;

function at(daysAgo: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function dayKey(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

async function main() {
  const email = process.env.REVIEW_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("REVIEW_EMAIL is not set in the environment");

  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Reviewer", role: "ATHLETE" },
  });

  // Clear any previous run so re-seeding does not stack duplicates.
  await db.$transaction([
    db.meal.deleteMany({ where: { userId: user.id } }),
    db.workout.deleteMany({ where: { userId: user.id } }),
    db.weightEntry.deleteMany({ where: { userId: user.id } }),
  ]);

  let weight = 78.6;

  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    weight -= 0.05;

    await db.weightEntry.create({
      data: {
        userId: user.id,
        day: dayKey(at(daysAgo, 7)),
        weightKg: Math.round(weight * 10) / 10,
      },
    });

    for (const [i, meal] of MEALS.entries()) {
      // A skipped snack here and there keeps the compliance strip honest.
      if (meal.slot === "SNACK" && daysAgo % 3 === 0) continue;
      await db.meal.create({
        data: {
          userId: user.id,
          title: meal.title,
          slot: meal.slot,
          calories: meal.kcal,
          protein: meal.p,
          carbs: meal.c,
          fat: meal.f,
          status: "COMPLETE",
          eatenAt: at(daysAgo, 8 + i * 4),
        },
      });
    }

    // Four sessions a week, on the days a lifter would actually train.
    if (daysAgo % 7 === 1 || daysAgo % 7 === 3 || daysAgo % 7 === 5) {
      const s = SESSIONS[daysAgo % SESSIONS.length];
      await db.workout.create({
        data: {
          userId: user.id,
          title: s.title,
          durationMin: s.min,
          status: "COMPLETE",
          performedAt: at(daysAgo, 18),
          exercises: {
            create: s.moves.map(([name, sets, reps, kg], position) => ({
              name: name as string,
              sets: sets as number,
              reps: reps as number,
              weightKg: kg as number,
              position,
            })),
          },
        },
      });
    }
  }

  // Free, with the trial already spent: the reviewer lands on the paywall.
  await db.user.update({
    where: { id: user.id },
    data: {
      plan: "FREE",
      planTerm: null,
      planExpiresAt: null,
      trialEndsAt: new Date(Date.now() - 30 * 86_400_000),
    },
  });

  const [meals, workouts, weights] = await Promise.all([
    db.meal.count({ where: { userId: user.id } }),
    db.workout.count({ where: { userId: user.id } }),
    db.weightEntry.count({ where: { userId: user.id } }),
  ]);

  console.log(`
Review account ready

  email     ${email}
  password  (whatever REVIEW_PASSWORD is set to)
  plan      Free, trial expired — the paywall and prices are visible
  data      ${meals} meals, ${workouts} workouts, ${weights} weigh-ins over 14 days

Set REVIEW_EMAIL and REVIEW_PASSWORD in Vercel and redeploy for the password
form to appear on /signin. Clear either variable to remove it again.
`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
