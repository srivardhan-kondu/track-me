/**
 * Gives one coach a full roster of demo athletes, each with weeks of history.
 *
 *   npm run demo:coach -- coach@example.com                    # dry run
 *   npm run demo:coach -- coach@example.com --apply            # write it
 *   npm run demo:coach -- coach@example.com --apply --reset    # rebuild, dated to today
 *   npm run demo:coach -- coach@example.com --remove           # delete every demo athlete
 *
 * Options:
 *   --name "Alan Smith"   set the coach's display name
 *   --reviewer            use the reviewer sign-in's account (REVIEW_EMAIL) as
 *                         the coach, creating it if needed
 *   --create-coach        create the coach account if it does not exist. Only
 *                         for the reviewer (email + password) sign-in: a
 *                         Google sign-in refuses an account it did not create.
 *
 * Reads DATABASE_URL from `.env.production.local` (git-ignored).
 *
 * Every demo athlete has a fixed @example.com address from
 * `demo-coach-data.ts`, and that address is how the script recognises its
 * own rows: --reset and --remove delete those accounts (their history goes
 * with them) and nothing else. The coach's own data is never touched beyond
 * its role and name.
 *
 * History runs up to the moment of the run, in each athlete's time zone, so
 * run it with --reset shortly before a demo to keep "today" current.
 */
import { Prisma, PrismaClient, type MealSlot } from "@prisma/client";

import { addDaysInZone, dayKeyInZone, fromDateParam, toDateParam } from "../src/lib/tz";
import { estimateFromText } from "../src/services/ai/food-table";
import { resolveExerciseId } from "../src/services/exercises/resolve";

import {
  ATHLETES,
  COACH_ON_MEAL,
  COACH_ON_WEIGHT,
  COACH_ON_WORKOUT,
  DIETS,
  PENDING,
  PROGRAMS,
  REPLIES,
  type Athlete,
  type MealIdea,
} from "./demo-coach-data";

const DEMO_EMAILS = [...ATHLETES.map((a) => a.email), ...PENDING.map((p) => p.email)];
const KG_PER_LB = 0.45359237;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const seedOf = (text: string) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function targetHost(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").host || "(unset)";
  } catch {
    return "(unparseable)";
  }
}

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

/** Rounds a load the way it would be on a bar: 2.5 kg steps, or 1 kg for light dumbbells. */
function plate(kg: number): number {
  const step = kg >= 20 ? 2.5 : 1;
  return Math.max(step, Math.round(kg / step) * step);
}

/** "90 kilos" or "200 pounds", the way the athlete would say it. */
function spoken(kg: number, us: boolean): string {
  return us ? `${Math.round(kg / KG_PER_LB / 5) * 5} pounds` : `${kg} kilos`;
}

const fill = (template: string, a: Athlete) => template.replaceAll("{name}", a.name.split(" ")[0]);

type Built = {
  meals: number;
  workouts: number;
  weighIns: number;
  comments: number;
  last7: number;
};

async function buildAthlete(
  db: PrismaClient,
  coachId: string,
  a: Athlete,
  order: number,
  catalog: Map<string, string | null>,
): Promise<Built> {
  const random = rng(seedOf(a.email));
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];
  const zone = a.timeZone;
  const us = a.units === "US";
  const now = new Date();
  const todayNoon = fromDateParam(toDateParam(now, zone), zone);
  const at = (daysAgo: number, hour: number, minute = 0) =>
    new Date(addDaysInZone(todayNoon, -daysAgo, zone).getTime() + ((hour - 12) * 60 + minute) * 60_000);
  const past = (d: Date) => d.getTime() < now.getTime() - 5 * 60_000;
  const joined = at(a.days, 9);

  const athlete = await db.user.create({
    data: {
      email: a.email,
      name: a.name,
      role: "ATHLETE",
      gender: a.gender,
      age: a.age,
      heightCm: a.heightCm,
      weightUnit: us ? "LB" : "KG",
      heightUnit: us ? "FT" : "CM",
      volumeUnit: us ? "FL_OZ" : "ML",
      timeZone: zone,
      targetCalories: a.targetCalories,
      targetWeightKg: a.targetWeightKg,
      waterGoalMl: a.waterGoalMl,
      onboardedAt: joined,
      createdAt: joined,
    },
  });

  // Roster order follows when the coach linked each athlete, so set it from
  // the list's order rather than each athlete's time zone.
  const linkedAt = new Date(now.getTime() - (60 - order) * 86_400_000);
  await db.coachAthlete.create({
    data: {
      coachId,
      athleteId: athlete.id,
      status: "ACCEPTED",
      createdAt: linkedAt,
      respondedAt: new Date(linkedAt.getTime() + 45 * 60_000),
    },
  });

  const diet = DIETS[a.diet];
  const program = PROGRAMS[a.program];
  const meals: Prisma.MealCreateManyInput[] = [];
  const weights: Prisma.WeightEntryCreateManyInput[] = [];
  const water: Prisma.WaterEntryCreateManyInput[] = [];
  const workoutIds: { id: string; at: Date }[] = [];
  let session = 0;
  let last7 = 0;

  const addMeal = (slot: MealSlot, idea: MealIdea, eatenAt: Date) => {
    if (!past(eatenAt)) return;
    // Same plate, different appetite: scaled per athlete and per sitting, so
    // two people eating the same breakfast don't show identical numbers.
    const f = a.portion * (0.86 + random() * 0.28);
    const raw = estimateFromText(idea.text);
    const r1 = (n: number) => Math.round(n * f * 10) / 10;
    const items = raw.items.map((i) => ({
      ...i,
      grams: Math.round(i.grams * f),
      quantity: `${Math.round(i.grams * f)} g`,
      calories: Math.round(i.calories * f),
      protein: r1(i.protein),
      carbs: r1(i.carbs),
      fat: r1(i.fat),
    }));
    const est = {
      items,
      calories: items.reduce((s, i) => s + i.calories, 0),
      protein: r1(raw.protein),
      carbs: r1(raw.carbs),
      fat: r1(raw.fat),
    };
    meals.push({
      userId: athlete.id,
      title: idea.title,
      slot,
      transcript: idea.text,
      calories: est.calories,
      protein: est.protein,
      carbs: est.carbs,
      fat: est.fat,
      items: est.items as unknown as Prisma.InputJsonValue,
      aiGenerated: true,
      status: "COMPLETE",
      eatenAt,
      createdAt: new Date(eatenAt.getTime() + 3 * 60_000),
    });
  };

  for (let daysAgo = a.days; daysAgo >= 0; daysAgo--) {
    // Drawn every day, logged or not, so one athlete's history is stable.
    const rolls = Array.from({ length: 12 }, () => random());
    const quiet = a.quietFor !== undefined && daysAgo < a.quietFor;
    const logs =
      !quiet &&
      (daysAgo === 0 ? true : daysAgo <= 6 ? !(a.missed ?? []).includes(daysAgo) : rolls[0] < a.logRate);
    if (!logs) continue;

    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short" }).format(at(daysAgo, 12));
    const weekend = weekday === "Sat" || weekday === "Sun";
    const mins = (r: number, span: number) => Math.floor(r * span);

    const before = meals.length;
    addMeal("BREAKFAST", pick(diet.breakfast), at(daysAgo, 7, mins(rolls[1], 90)));
    addMeal("LUNCH", pick(diet.lunch), at(daysAgo, 12, mins(rolls[2], 75)));
    if (rolls[3] < 0.75) addMeal("SNACK", pick(diet.snack), at(daysAgo, 15, 30 + mins(rolls[4], 80)));
    addMeal(
      "DINNER",
      weekend && rolls[5] < 0.4 ? pick(diet.treat) : pick(diet.dinner),
      at(daysAgo, 18, 30 + mins(rolls[6], 100)),
    );
    // Bigger appetites eat a fifth time.
    if (a.portion >= 1.2) addMeal("SNACK", pick(diet.snack), at(daysAgo, 21, mins(rolls[7], 40)));
    if (daysAgo < 7 && meals.length > before) last7++;

    const weighAt = at(daysAgo, 6, 30 + mins(rolls[8], 60));
    if (rolls[9] < 0.88 && past(weighAt)) {
      // Smaller than a week of progress, so the weekly change reads as the goal.
      const wobble = (rolls[10] - 0.5) * 0.3;
      const kg = Math.round((a.weightKg - a.trend * daysAgo + wobble) * 10) / 10;
      weights.push({
        userId: athlete.id,
        day: dayKeyInZone(weighAt, zone),
        weightKg: us ? Math.round((kg / KG_PER_LB) * 10) / 10 * KG_PER_LB : kg,
        createdAt: weighAt,
      });
    }

    // Water: around the goal, and only what has been drunk by now today.
    const share = daysAgo === 0 ? Math.min(1, Math.max(0, (now.getTime() - at(0, 7).getTime()) / (14 * 3_600_000))) : 1;
    const ml = Math.round((a.waterGoalMl * (0.72 + rolls[11] * 0.45) * share) / 250) * 250;
    if (ml > 0) water.push({ userId: athlete.id, day: dayKeyInZone(at(daysAgo, 12), zone), ml });

    // Training days.
    if (random() < a.trainsPerWeek / 7) {
      const plan = program[session % program.length];
      const morning = a.program === "endurance" || a.program === "athletic";
      const performedAt = at(daysAgo, morning ? 6 : 17, 15 + Math.floor(random() * 90));
      const minutes = plan.minutes + Math.round((random() - 0.5) * 10);
      if (!past(new Date(performedAt.getTime() + minutes * 60_000))) continue;
      session++;

      // Steady progress: about 2.5% stronger a week across the history.
      const weeksAgo = daysAgo / 7;
      const lifts = plan.lifts.map((l) => ({
        ...l,
        kg: l.kg === null ? null : plate(l.kg * (1 - 0.025 * weeksAgo)),
      }));
      const transcript =
        lifts
          .map((l) =>
            l.seconds
              ? `${l.name} for ${Math.round(l.seconds / 60)} minutes`
              : l.kg
                ? `${l.name} ${spoken(l.kg, us)} ${l.sets} sets of ${l.reps}`
                : `${l.name} ${l.sets} sets of ${l.reps}`,
          )
          .join(". ") + `. About ${minutes} minutes.`;

      const workout = await db.workout.create({
        data: {
          userId: athlete.id,
          title: plan.title,
          transcript,
          durationMin: minutes,
          aiGenerated: true,
          status: "COMPLETE",
          performedAt,
          createdAt: new Date(performedAt.getTime() + minutes * 60_000),
          exercises: {
            create: lifts.map((l, i) => ({
              name: l.name,
              weightKg: l.kg,
              sets: l.sets,
              reps: l.seconds ? null : l.reps,
              position: i,
              catalogId: catalog.get(l.name) ?? null,
              setLog: {
                create: Array.from({ length: l.sets }, (_, s) => ({
                  position: s,
                  kind: "WORKING" as const,
                  weightKg: l.kg,
                  // The last set of a heavy lift sometimes loses a rep.
                  reps: l.seconds ? null : Math.max(1, l.reps - (s === l.sets - 1 && random() < 0.4 ? 1 : 0)),
                  seconds: l.seconds ?? null,
                })),
              },
            })),
          },
        },
      });
      workoutIds.push({ id: workout.id, at: workout.createdAt });
    }
  }

  const savedMeals = await db.meal.createManyAndReturn({ data: meals, select: { id: true, eatenAt: true } });
  const savedWeights = await db.weightEntry.createManyAndReturn({ data: weights, select: { id: true, createdAt: true } });
  await db.waterEntry.createMany({ data: water });

  // The coach reads, and sometimes the athlete answers.
  const comments: Prisma.CommentCreateManyInput[] = [];
  const converse = (
    target: { mealId?: string; workoutId?: string; weightEntryId?: string },
    itemAt: Date,
    lines: string[],
    chance: number,
  ) => {
    const ageH = (now.getTime() - itemAt.getTime()) / 3_600_000;
    // Recent work gets more attention, and nothing is answered before it happens.
    if (ageH < 1.5 || random() > chance * (ageH < 24 * 10 ? 1.6 : 0.6)) return;
    const coachAt = new Date(itemAt.getTime() + Math.min(ageH - 1, 2 + random() * 10) * 3_600_000);
    comments.push({ ...target, authorId: coachId, body: fill(pick(lines), a), createdAt: coachAt });
    const replyAt = new Date(coachAt.getTime() + (0.5 + random() * 3) * 3_600_000);
    if (random() < 0.55 && past(replyAt)) {
      comments.push({ ...target, authorId: athlete.id, body: pick(REPLIES), createdAt: replyAt });
    }
  };
  savedMeals.forEach((m) => converse({ mealId: m.id }, m.eatenAt, COACH_ON_MEAL, 0.06));
  workoutIds.forEach((w) => converse({ workoutId: w.id }, w.at, COACH_ON_WORKOUT, 0.22));
  savedWeights.forEach((w) => converse({ weightEntryId: w.id }, w.createdAt, COACH_ON_WEIGHT, 0.06));
  if (comments.length) await db.comment.createMany({ data: comments });

  return {
    meals: savedMeals.length,
    workouts: workoutIds.length,
    weighIns: savedWeights.length,
    comments: comments.length,
    last7,
  };
}

async function removeDemo(db: PrismaClient): Promise<number> {
  // Cascades take each athlete's meals, workouts, weigh-ins, water, comments and links.
  const { count } = await db.user.deleteMany({
    where: { email: { in: DEMO_EMAILS }, accounts: { none: {} } },
  });
  return count;
}

async function main() {
  const args = process.argv.slice(2);
  // --reviewer: the account behind the reviewer email-and-password sign-in,
  // read from REVIEW_EMAIL so the address never has to be typed anywhere.
  const reviewer = args.includes("--reviewer");
  if (reviewer && !process.env.REVIEW_EMAIL) {
    throw new Error("--reviewer needs REVIEW_EMAIL in .env.production.local");
  }
  const email = (reviewer ? process.env.REVIEW_EMAIL : args.find((a) => a.includes("@") && !a.startsWith("--")))
    ?.trim()
    .toLowerCase();
  const apply = args.includes("--apply");
  const reset = args.includes("--reset");
  const remove = args.includes("--remove");
  const createCoach = args.includes("--create-coach") || args.includes("--reviewer");
  const name = argValue(args, "--name");

  const db = new PrismaClient();
  try {
    console.log(`Target   ${targetHost()}`);

    if (remove) {
      console.log(`Removed ${await removeDemo(db)} demo athlete accounts and everything they logged.`);
      return;
    }
    if (!email) throw new Error('Usage: npm run demo:coach -- <coach-email> [--name "Alan Smith"] [--apply] [--reset]');
    if (DEMO_EMAILS.includes(email)) throw new Error("That address belongs to a demo athlete.");

    let coach = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, role: true, _count: { select: { meals: true, accounts: true } } },
    });
    if (!coach && !createCoach) {
      throw new Error(
        `No account for ${email}. If the coach signs in with Google, have them sign in once first. ` +
          "If they use the reviewer email and password, add --create-coach.",
      );
    }

    const existing = await db.user.findMany({
      where: { email: { in: DEMO_EMAILS } },
      select: { email: true, _count: { select: { accounts: true } } },
    });
    if (existing.some((u) => u._count.accounts > 0)) {
      throw new Error("A demo address has a real sign-in attached; refusing to touch it.");
    }
    if (existing.length && !reset) {
      throw new Error(`${existing.length} demo athletes already exist. Add --reset to rebuild them dated to today.`);
    }

    console.log(`Coach    ${email} · ${coach ? `${coach.name ?? "(no name)"} · ${coach.role}` : "will be created"}${name ? ` → named "${name}"` : ""}`);
    if (coach && coach.role !== "COACH") {
      console.log(`  note: this account becomes a coach${coach._count.meals ? `; its own ${coach._count.meals} meals stay, but it will see the coach screens` : ""}.`);
    }
    console.log(`Athletes ${ATHLETES.length} on the roster, ${PENDING.length} waiting to accept${existing.length ? ` (replacing ${existing.length} existing)` : ""}`);
    if (!apply) {
      console.log("\nDry run, nothing is written. Add --apply to write.");
      return;
    }

    if (existing.length) console.log(`\nRemoved ${await removeDemo(db)} previous demo accounts.`);

    if (coach) {
      await db.user.update({
        where: { id: coach.id },
        data: { role: "COACH", ...(name ? { name } : {}), onboardedAt: new Date() },
      });
    } else {
      const created = await db.user.create({
        data: { email, name: name ?? "Coach", role: "COACH", onboardedAt: new Date() },
        select: { id: true, name: true, role: true },
      });
      coach = { ...created, _count: { meals: 0, accounts: 0 } };
    }

    const names = [...new Set(Object.values(PROGRAMS).flatMap((p) => p.flatMap((s) => s.lifts.map((l) => l.name))))];
    const catalog = new Map(await Promise.all(names.map(async (n) => [n, await resolveExerciseId(n)] as const)));
    const missing = names.filter((n) => !catalog.get(n));
    if (missing.length) console.log(`  note: not in the exercise catalog, so no muscle data: ${missing.join(", ")}`);

    console.log("");
    for (const [i, a] of ATHLETES.entries()) {
      const r = await buildAthlete(db, coach.id, a, i, catalog);
      const ratio = r.last7 / 7;
      const badge = ratio >= 0.8 ? "On track" : ratio >= 0.5 ? "Patchy" : "Falling off";
      console.log(
        `  ${a.name.padEnd(16)} ${badge.padEnd(11)} ${r.last7}/7 days · ${String(r.meals).padStart(3)} meals · ${String(r.workouts).padStart(2)} workouts · ${String(r.weighIns).padStart(2)} weigh-ins · ${r.comments} comments`,
      );
    }

    for (const [i, p] of PENDING.entries()) {
      const u = await db.user.create({
        data: { email: p.email, name: p.name, role: "ATHLETE", onboardedAt: new Date(), timeZone: "America/New_York" },
      });
      await db.coachAthlete.create({
        data: { coachId: coach.id, athleteId: u.id, status: "PENDING", createdAt: new Date(Date.now() - (i + 1) * 5 * 3_600_000) },
      });
    }
    console.log(`  ${PENDING.map((p) => p.name).join(" and ")}: request pending\n\nDone.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
