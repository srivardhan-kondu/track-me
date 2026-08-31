/**
 * Checks that realistically dictated exercise names resolve to the catalog.
 *
 *   node --import tsx --env-file=.env scripts/check-exercises.ts
 */
import { db } from "../src/lib/db";
import { resolveExerciseId } from "../src/services/exercises/resolve";

/** [what an athlete says, expected catalog slug or null] */
const CASES: [string, string | null][] = [
  ["bench press", "barbell-bench-press"],
  ["Bench Press", "barbell-bench-press"],
  ["flat bench", "barbell-bench-press"],
  ["incline dumbbell press", "incline-dumbbell-press"],
  ["incline db press", "incline-dumbbell-press"],
  ["incline press", "incline-barbell-bench-press"],
  ["chest flyes", "dumbbell-chest-fly"],
  ["dumbbell bench", "dumbbell-bench-press"],
  ["overhead press", "barbell-overhead-press"],
  ["ohp", "barbell-overhead-press"],
  ["military press", "barbell-overhead-press"],
  ["lat pulldown", "lat-pulldown"],
  ["pull ups", "pull-up"],
  ["chin up", "chin-up"],
  ["barbell row", "barbell-row"],
  ["bent over row", "barbell-row"],
  ["one arm row", "dumbbell-row"],
  ["seated cable row", "seated-cable-row"],
  ["squat", "back-squat"],
  ["back squat", "back-squat"],
  ["front squat", "front-squat"],
  ["leg press", "leg-press"],
  ["deadlift", "conventional-deadlift"],
  ["romanian deadlift", "romanian-deadlift"],
  ["rdls", "romanian-deadlift"],
  ["hip thrust", "barbell-hip-thrust"],
  ["bulgarian split squat", "bulgarian-split-squat"],
  ["rfess", "bulgarian-split-squat"],
  ["walking lunges", "walking-lunge"],
  ["bicep curl", "barbell-curl"],
  ["hammer curls", "hammer-curl"],
  ["tricep pushdown", "tricep-pushdown"],
  ["rope pushdown", "tricep-pushdown"],
  ["skull crushers", "skull-crusher"],
  ["lateral raises", "lateral-raise"],
  ["side raise", "lateral-raise"],
  ["face pulls", "face-pull"],
  ["rear delt fly", "rear-delt-fly"],
  ["shrugs", "barbell-shrug"],
  ["leg extension", "leg-extension"],
  ["leg curls", "lying-leg-curl"],
  ["calf raises", "standing-calf-raise"],
  ["planks", "plank"],
  ["hanging leg raise", "hanging-leg-raise"],
  ["russian twists", "russian-twist"],
  ["kettlebell swings", "kettlebell-swing"],
  ["power clean", "power-clean"],
  ["treadmill", "treadmill-run"],
  ["rowing machine", "rowing-machine"],
  ["jump rope", "jump-rope"],
  ["dips", "chest-dip"],
  ["push ups", "push-up"],
  // Should not resolve — nothing in the catalog covers these.
  ["fluffernutter press", null],
  ["stretching a bit", null],
];

async function main() {
  const slugById = new Map(
    (await db.catalogExercise.findMany({ select: { id: true, slug: true } })).map(
      (r) => [r.id, r.slug],
    ),
  );

  let pass = 0;
  const failures: string[] = [];

  for (const [input, expected] of CASES) {
    const id = await resolveExerciseId(input);
    const got = id ? (slugById.get(id) ?? "?") : null;
    if (got === expected) pass++;
    else failures.push(`  "${input}"  expected ${expected ?? "no match"}, got ${got ?? "no match"}`);
  }

  console.log(`\n  ${pass}/${CASES.length} dictated names resolved as expected`);
  if (failures.length) {
    console.log("\n  mismatches:");
    for (const f of failures) console.log(f);
  }
  console.log("");
  await db.$disconnect();
  if (failures.length) process.exitCode = 1;
}

main();
