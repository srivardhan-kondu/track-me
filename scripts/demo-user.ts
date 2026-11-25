/**
 * Fills one existing account with ~3 weeks of realistic history, for a demo.
 *
 *   npm run demo:user -- someone@example.com            # dry run: shows the plan
 *   npm run demo:user -- someone@example.com --apply    # writes it
 *   npm run demo:user -- --undo demo-user-<stamp>.json  # removes exactly what a run added
 *
 * Reads DATABASE_URL from `.env.production.local` (git-ignored), so it can
 * point at the production database without touching the local `.env`.
 *
 * It only ever adds. A day that already has a meal keeps its own meals, an
 * existing weigh-in or water total is never overwritten, the profile is left
 * alone, and nothing belonging to anyone else is read or written. Every row
 * it creates is listed in a receipt file, which `--undo` deletes by id.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { PrismaClient, type MealSlot } from "@prisma/client";

import { safeZone, toDateParam, fromDateParam, addDaysInZone, dayKeyInZone } from "../src/lib/tz";
import { estimateFromText } from "../src/services/ai/food-table";
import { resolveExerciseId } from "../src/services/exercises/resolve";

const DAYS = 21;

const MEALS: { hour: number; slot: MealSlot; title: string; transcript: string }[] = [
  { hour: 8, slot: "BREAKFAST", title: "Oats and eggs", transcript: "80g oats with milk, and three eggs scrambled." },
  { hour: 13, slot: "LUNCH", title: "Chicken and rice", transcript: "200g chicken breast, one cup of rice and a big salad." },
  { hour: 17, slot: "SNACK", title: "Protein shake", transcript: "One scoop of whey protein with 250ml milk and a banana." },
  { hour: 20, slot: "DINNER", title: "Paneer and roti", transcript: "150g paneer with two rotis and vegetables." },
];

const WORKOUTS = [
  {
    title: "Push day",
    transcript: "Bench press 80 kilos 3 sets of 8. Incline dumbbell press 30 kilos 3 sets of 10. Overhead press 45 kilos 3 sets of 8. Tricep pushdown 25 kilos 3 sets of 12. Around 65 minutes.",
    durationMin: 65,
    exercises: [
      { name: "Bench Press", weightKg: 80, sets: 3, reps: 8 },
      { name: "Incline Press", weightKg: 30, sets: 3, reps: 10 },
      { name: "Overhead Press", weightKg: 45, sets: 3, reps: 8 },
      { name: "Tricep Pushdown", weightKg: 25, sets: 3, reps: 12 },
    ],
  },
  {
    title: "Pull day",
    transcript: "Deadlift 140 kilos 3 sets of 5. Barbell row 70 kilos 4 sets of 8. Lat pulldown 60 kilos 3 sets of 10. Bicep curl 15 kilos 3 sets of 12. About 70 minutes.",
    durationMin: 70,
    exercises: [
      { name: "Deadlift", weightKg: 140, sets: 3, reps: 5 },
      { name: "Barbell Row", weightKg: 70, sets: 4, reps: 8 },
      { name: "Lat Pulldown", weightKg: 60, sets: 3, reps: 10 },
      { name: "Bicep Curl", weightKg: 15, sets: 3, reps: 12 },
    ],
  },
  {
    title: "Legs",
    transcript: "Back squat 110 kilos 4 sets of 6. Romanian deadlift 90 kilos 3 sets of 8. Leg press 180 kilos 3 sets of 12. Calf raise 60 kilos 4 sets of 15. 75 minutes.",
    durationMin: 75,
    exercises: [
      { name: "Back Squat", weightKg: 110, sets: 4, reps: 6 },
      { name: "Romanian Deadlift", weightKg: 90, sets: 3, reps: 8 },
      { name: "Leg Press", weightKg: 180, sets: 3, reps: 12 },
      { name: "Calf Raise", weightKg: 60, sets: 4, reps: 15 },
    ],
  },
];

type Receipt = {
  email: string;
  userId: string;
  createdAt: string;
  meals: string[];
  workouts: string[];
  weightEntries: string[];
  waterEntries: string[];
};

/** Deterministic, so a dry run and the real run plan the same history. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function targetHost(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").host || "(unset)";
  } catch {
    return "(unparseable)";
  }
}

async function undo(db: PrismaClient, file: string) {
  const r: Receipt = JSON.parse(readFileSync(file, "utf8"));
  console.log(`Removing what ${file} added for ${r.email} on ${targetHost()}…`);
  // Exercises cascade with their workout; every delete is scoped to the user.
  const where = (ids: string[]) => ({ id: { in: ids }, userId: r.userId });
  const [m, w, wt, wa] = await db.$transaction([
    db.meal.deleteMany({ where: where(r.meals) }),
    db.workout.deleteMany({ where: where(r.workouts) }),
    db.weightEntry.deleteMany({ where: where(r.weightEntries) }),
    db.waterEntry.deleteMany({ where: where(r.waterEntries) }),
  ]);
  console.log(`  removed ${m.count} meals, ${w.count} workouts, ${wt.count} weigh-ins, ${wa.count} water days`);
}

async function main() {
  const args = process.argv.slice(2);
  const db = new PrismaClient();

  try {
    if (args[0] === "--undo") {
      if (!args[1]) throw new Error("Usage: --undo <receipt.json>");
      await undo(db, args[1]);
      return;
    }

    const email = args.find((a) => a.includes("@"))?.trim().toLowerCase();
    const apply = args.includes("--apply");
    if (!email) throw new Error("Usage: npm run demo:user -- <email> [--apply]");

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, role: true, timeZone: true, onboardedAt: true },
    });
    if (!user) {
      throw new Error(`No account for ${email} on ${targetHost()}. Sign in to the app once first, then run this again.`);
    }

    const tz = safeZone(user.timeZone ?? "Asia/Kolkata");
    const latest = await db.weightEntry.findFirst({
      where: { userId: user.id },
      orderBy: { day: "desc" },
      select: { weightKg: true },
    });
    // End the trend at the athlete's real latest weight, if they have one.
    const endWeight = latest?.weightKg ?? 78;
    const trendPerDay = -0.06;

    // Midday today in the athlete's zone; every planned time is built from it.
    const todayNoon = fromDateParam(toDateParam(new Date(), tz), tz);
    const at = (daysAgo: number, hour: number, minute: number) =>
      new Date(addDaysInZone(todayNoon, -daysAgo, tz).getTime() + ((hour - 12) * 60 + minute) * 60_000);

    const random = rng(email.length * 7919 + 17);
    const plan = { meals: 0, workouts: 0, weigh: 0, water: 0, skippedDays: 0 };
    const receipt: Receipt = {
      email, userId: user.id, createdAt: new Date().toISOString(),
      meals: [], workouts: [], weightEntries: [], waterEntries: [],
    };

    console.log(`Target   ${targetHost()}`);
    console.log(`Account  ${email} · ${user.name ?? "(no name)"} · ${user.role} · zone ${tz}`);
    if (user.role !== "ATHLETE") console.log("  note: this account is a coach; the history shows on athlete screens only.");
    if (!user.onboardedAt) console.log("  note: not onboarded yet; the app will show onboarding first.");
    console.log(apply ? "\nWriting…" : "\nDry run, nothing is written. Add --apply to write.\n");

    // History up to yesterday; today is left for the live demo.
    for (let daysAgo = DAYS; daysAgo >= 1; daysAgo--) {
      const missed = random() < 0.1;
      const weight = endWeight - trendPerDay * daysAgo + (random() - 0.5) * 0.6;
      const mealCount = random() < 0.7 ? 4 : 3;
      const trains = random() < 0.75;
      const waterMl = 250 * (7 + Math.floor(random() * 7));
      const minutes = Array.from({ length: 6 }, () => Math.floor(random() * 40));
      if (missed) continue;

      const day = dayKeyInZone(at(daysAgo, 12, 0), tz);
      const dayStart = at(daysAgo, 0, 0);
      const dayEnd = at(daysAgo, 23, 59);

      const hasMeals = await db.meal.count({
        where: { userId: user.id, eatenAt: { gte: dayStart, lte: dayEnd } },
      });
      if (hasMeals) {
        plan.skippedDays++;
        continue;
      }
      const hasWeight = await db.weightEntry.findUnique({ where: { userId_day: { userId: user.id, day } } });
      const hasWater = await db.waterEntry.findUnique({ where: { userId_day: { userId: user.id, day } } });
      const hasWorkout = await db.workout.count({
        where: { userId: user.id, performedAt: { gte: dayStart, lte: dayEnd } },
      });

      plan.meals += mealCount;
      if (!hasWeight) plan.weigh++;
      if (!hasWater) plan.water++;
      if (trains && !hasWorkout) plan.workouts++;
      if (!apply) continue;

      if (!hasWeight) {
        const row = await db.weightEntry.create({
          data: { userId: user.id, day, weightKg: Math.round(weight * 10) / 10 },
        });
        receipt.weightEntries.push(row.id);
      }
      if (!hasWater) {
        const row = await db.waterEntry.create({ data: { userId: user.id, day, ml: waterMl } });
        receipt.waterEntries.push(row.id);
      }
      for (let i = 0; i < mealCount; i++) {
        const tpl = MEALS[i];
        const est = estimateFromText(tpl.transcript);
        const row = await db.meal.create({
          data: {
            userId: user.id,
            title: tpl.title,
            slot: tpl.slot,
            transcript: tpl.transcript,
            calories: est.calories,
            protein: est.protein,
            carbs: est.carbs,
            fat: est.fat,
            items: est.items,
            status: "COMPLETE",
            eatenAt: at(daysAgo, tpl.hour, minutes[i]),
          },
        });
        receipt.meals.push(row.id);
      }
      if (trains && !hasWorkout) {
        const tpl = WORKOUTS[daysAgo % WORKOUTS.length];
        const catalogIds = await Promise.all(tpl.exercises.map((ex) => resolveExerciseId(ex.name)));
        const row = await db.workout.create({
          data: {
            userId: user.id,
            title: tpl.title,
            transcript: tpl.transcript,
            durationMin: tpl.durationMin,
            status: "COMPLETE",
            performedAt: at(daysAgo, 18, minutes[5]),
            exercises: {
              create: tpl.exercises.map((ex, i) => ({ ...ex, position: i, catalogId: catalogIds[i] })),
            },
          },
        });
        receipt.workouts.push(row.id);
      }
    }

    console.log(`  ${plan.meals} meals, ${plan.workouts} workouts, ${plan.weigh} weigh-ins, ${plan.water} water days`);
    if (plan.skippedDays) console.log(`  ${plan.skippedDays} days left alone because they already have meals`);

    if (apply) {
      const file = `demo-user-${receipt.createdAt.replace(/[:.]/g, "-")}.json`;
      writeFileSync(file, JSON.stringify(receipt, null, 2));
      console.log(`\nDone. Receipt: ${file}\nUndo with: npm run demo:user -- --undo ${file}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
