/**
 * Seeds a coach, two athletes and ~3 weeks of logged history so the dashboards
 * are immediately meaningful. Safe to re-run: it clears only the seeded users.
 */
import { PrismaClient, type MealSlot, type Pose } from "@prisma/client";

import { estimateFromText } from "../src/services/ai/food-table";

const db = new PrismaClient();

const COACH_EMAIL = "coach@gymos.dev";
const ATHLETE_EMAIL = "athlete@gymos.dev";
const ATHLETE_TWO_EMAIL = "priya@gymos.dev";

type MealTemplate = {
  hour: number;
  slot: MealSlot;
  title: string;
  transcript: string;
};

const MEAL_TEMPLATES: MealTemplate[] = [
  {
    hour: 8,
    slot: "BREAKFAST",
    title: "Oats and eggs",
    transcript: "80g oats with milk, and three eggs scrambled.",
  },
  {
    hour: 13,
    slot: "LUNCH",
    title: "Chicken and rice",
    transcript: "200g chicken breast, one cup of rice and a big salad.",
  },
  {
    hour: 17,
    slot: "SNACK",
    title: "Protein shake",
    transcript: "One scoop of whey protein with 250ml milk and a banana.",
  },
  {
    hour: 20,
    slot: "DINNER",
    title: "Paneer and roti",
    transcript: "150g paneer with two rotis and vegetables.",
  },
];

const WORKOUT_TEMPLATES = [
  {
    title: "Push day",
    transcript:
      "Bench press 80 kilos 3 sets of 8. Then incline dumbbell press 30 kilos 3 sets of 10. Overhead press 45 kilos 3 sets of 8. Finished with tricep pushdown 25 kilos 3 sets of 12. Around 65 minutes.",
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
    transcript:
      "Deadlift 140 kilos 3 sets of 5. Barbell row 70 kilos 4 sets of 8. Lat pulldown 60 kilos 3 sets of 10. Bicep curl 15 kilos 3 sets of 12. About 70 minutes.",
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
    transcript:
      "Back squat 110 kilos 4 sets of 6. Romanian deadlift 90 kilos 3 sets of 8. Leg press 180 kilos 3 sets of 12. Calf raise 60 kilos 4 sets of 15. 75 minutes.",
    durationMin: 75,
    exercises: [
      { name: "Back Squat", weightKg: 110, sets: 4, reps: 6 },
      { name: "Romanian Deadlift", weightKg: 90, sets: 3, reps: 8 },
      { name: "Leg Press", weightKg: 180, sets: 3, reps: 12 },
      { name: "Calf Raise", weightKg: 60, sets: 4, reps: 15 },
    ],
  },
];

const COACH_NOTES = [
  "Protein is a little short here — add a scoop of whey or an extra 100g of chicken.",
  "Good session. Next week take the bench to 82.5kg for the same rep range.",
  "This is the third day above target calories. Tighten the evening meal.",
  "Weight is trending down about 0.4kg a week — exactly where we want it.",
  "Nice consistency this week. Keep the breakfast identical, it's working.",
];

function dayKey(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function at(daysAgo: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Deterministic pseudo-random so re-seeding produces the same history. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

async function seedAthlete(
  athleteId: string,
  coachId: string,
  options: { days: number; startWeight: number; trendPerDay: number; seed: number },
) {
  const random = rng(options.seed);

  for (let daysAgo = options.days; daysAgo >= 0; daysAgo--) {
    // Occasional missed day keeps the compliance strip honest.
    const skipped = random() < 0.12;

    const weight =
      options.startWeight +
      options.trendPerDay * (options.days - daysAgo) +
      (random() - 0.5) * 0.6;

    if (!skipped) {
      await db.weightEntry.upsert({
        where: {
          userId_day: { userId: athleteId, day: dayKey(at(daysAgo, 7)) },
        },
        create: {
          userId: athleteId,
          day: dayKey(at(daysAgo, 7)),
          weightKg: Math.round(weight * 10) / 10,
          notes: random() < 0.2 ? "Slept well, feeling strong." : null,
        },
        update: {},
      });
    }

    if (skipped) continue;

    // Most days log 3–4 meals.
    const mealCount = random() < 0.7 ? 4 : 3;
    for (let i = 0; i < mealCount; i++) {
      const tpl = MEAL_TEMPLATES[i % MEAL_TEMPLATES.length];
      const est = estimateFromText(tpl.transcript);

      const meal = await db.meal.create({
        data: {
          userId: athleteId,
          title: tpl.title,
          slot: tpl.slot,
          transcript: tpl.transcript,
          calories: est.calories,
          protein: est.protein,
          carbs: est.carbs,
          fat: est.fat,
          items: est.items,
          status: "COMPLETE",
          eatenAt: at(daysAgo, tpl.hour, Math.floor(random() * 40)),
        },
      });

      // The coach comments on roughly one meal in fifteen.
      if (random() < 0.07) {
        await db.comment.create({
          data: {
            authorId: coachId,
            mealId: meal.id,
            body: COACH_NOTES[Math.floor(random() * COACH_NOTES.length)],
            createdAt: at(daysAgo, tpl.hour + 2),
          },
        });
      }
    }

    // Train four days in five.
    if (random() < 0.75) {
      const tpl = WORKOUT_TEMPLATES[daysAgo % WORKOUT_TEMPLATES.length];
      const workout = await db.workout.create({
        data: {
          userId: athleteId,
          title: tpl.title,
          transcript: tpl.transcript,
          durationMin: tpl.durationMin,
          status: "COMPLETE",
          performedAt: at(daysAgo, 18, Math.floor(random() * 45)),
          exercises: {
            create: tpl.exercises.map((ex, i) => ({ ...ex, position: i })),
          },
        },
      });

      if (random() < 0.12) {
        await db.comment.create({
          data: {
            authorId: coachId,
            workoutId: workout.id,
            body: COACH_NOTES[Math.floor(random() * COACH_NOTES.length)],
            createdAt: at(daysAgo, 20),
          },
        });
      }
    }
  }

  // A few progress photo placeholders across recent months.
  const poses: Pose[] = ["FRONT", "SIDE", "BACK"];
  for (const monthsAgo of [2, 1, 0]) {
    for (const pose of poses) {
      const takenAt = new Date();
      takenAt.setMonth(takenAt.getMonth() - monthsAgo, 1);
      await db.progressPhoto.create({
        data: {
          userId: athleteId,
          pose,
          // No object is written; the card renders its unavailable state.
          imageKey: `progress/${athleteId}/seed/${monthsAgo}-${pose.toLowerCase()}.jpg`,
          takenAt,
        },
      });
    }
  }
}

async function main() {
  console.log("Seeding GymOS…");

  const emails = [COACH_EMAIL, ATHLETE_EMAIL, ATHLETE_TWO_EMAIL];
  await db.user.deleteMany({ where: { email: { in: emails } } });

  const coach = await db.user.create({
    data: { email: COACH_EMAIL, name: "Sam Rivera", role: "COACH" },
  });

  const athlete = await db.user.create({
    data: { email: ATHLETE_EMAIL, name: "Alex Kumar", role: "ATHLETE" },
  });

  const athleteTwo = await db.user.create({
    data: { email: ATHLETE_TWO_EMAIL, name: "Priya Nair", role: "ATHLETE" },
  });

  await db.coachAthlete.createMany({
    data: [
      { coachId: coach.id, athleteId: athlete.id },
      { coachId: coach.id, athleteId: athleteTwo.id },
    ],
  });

  await seedAthlete(athlete.id, coach.id, {
    days: 20,
    startWeight: 82.4,
    trendPerDay: -0.06,
    seed: 42,
  });

  await seedAthlete(athleteTwo.id, coach.id, {
    days: 20,
    startWeight: 61.2,
    trendPerDay: 0.02,
    seed: 7,
  });

  const [meals, workouts, weights] = await Promise.all([
    db.meal.count(),
    db.workout.count(),
    db.weightEntry.count(),
  ]);

  console.log(`
Seeded:
  coach    ${COACH_EMAIL}
  athletes ${ATHLETE_EMAIL}, ${ATHLETE_TWO_EMAIL}
  ${meals} meals, ${workouts} workouts, ${weights} weigh-ins

Sign in with any of those emails using the development sign-in.
`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
