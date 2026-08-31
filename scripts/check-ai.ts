/**
 * Exercises the real OpenAI integration end to end:
 * Whisper transcription, GPT Vision nutrition estimation, workout parsing.
 *
 *   node --import tsx --env-file=.env scripts/check-ai.ts [audio.m4a] [meal.jpg]
 */
import { readFile } from "node:fs/promises";

import { aiEnabled, TRANSCRIBE_MODEL, VISION_MODEL } from "../src/services/ai/client";
import { analyzeMeal } from "../src/services/ai/nutrition";
import { transcribeAudio } from "../src/services/ai/transcribe";
import { parseWorkout } from "../src/services/ai/workout";

const [audioPath, imagePath] = process.argv.slice(2);

function money(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("\nOpenAI integration check");
  console.log(`  key present   ${aiEnabled}`);
  console.log(`  transcribe    ${TRANSCRIBE_MODEL}`);
  console.log(`  vision        ${VISION_MODEL}\n`);

  if (!aiEnabled) {
    console.error("OPENAI_API_KEY is not set — nothing to check.");
    process.exit(1);
  }

  let transcript =
    "200g grilled chicken breast, one cup of white rice, and a bowl of broccoli.";

  if (audioPath) {
    console.log("1. Whisper transcription");
    const audio = await readFile(audioPath);
    const t0 = Date.now();
    const { text: spoken, costUnits } = await transcribeAudio(
      audio,
      audioPath.split("/").pop(),
    );
    money(
      "returned a transcript",
      Boolean(spoken),
      `${Date.now() - t0}ms · ~$${(costUnits / 1000).toFixed(4)}`,
    );
    if (spoken) {
      console.log(`        "${spoken}"`);
      transcript = spoken;
    }
    console.log("");
  }

  console.log("2. Nutrition estimation");
  const image = imagePath
    ? { buffer: await readFile(imagePath), contentType: "image/jpeg" }
    : null;

  const t1 = Date.now();
  const meal = await analyzeMeal({ transcript, image });
  money("model produced the estimate", meal.aiGenerated, `${Date.now() - t1}ms`);
  money("has a title", Boolean(meal.title), meal.title);
  money("has items", meal.items.length > 0, `${meal.items.length} items`);
  money(
    "totals are plausible",
    meal.calories > 0 && meal.protein > 0,
    `${Math.round(meal.calories)} kcal · ${Math.round(meal.protein)}g P · ${Math.round(meal.carbs)}g C · ${Math.round(meal.fat)}g F`,
  );

  const itemSum = meal.items.reduce((a, i) => a + i.calories, 0);
  money(
    "totals match the item sum",
    Math.abs(itemSum - meal.calories) <= Math.max(25, meal.calories * 0.06),
    `items ${Math.round(itemSum)} vs total ${Math.round(meal.calories)}`,
  );

  console.log("\n     breakdown:");
  for (const i of meal.items) {
    console.log(
      `       ${i.name} (${i.quantity}) — ${Math.round(i.calories)} kcal, ${Math.round(i.protein)}g protein`,
    );
  }

  console.log("\n3. Workout parsing");
  const t2 = Date.now();
  const workout = await parseWorkout(
    "Bench press 80 kilos 3 sets of 8, then incline dumbbell press 30 kilos 3 sets of 10, finished with tricep pushdown 25 kilos 3 by 12. About 65 minutes.",
  );
  money("model parsed the session", workout.aiGenerated, `${Date.now() - t2}ms`);
  money("found all three exercises", workout.exercises.length === 3, workout.title);
  money("read the duration", workout.durationMin === 65, `${workout.durationMin} min`);
  for (const e of workout.exercises) {
    console.log(
      `       ${e.name} — ${e.weightKg ?? "BW"}kg ${e.sets ?? "?"}x${e.reps ?? "?"}`,
    );
  }
  console.log("");
}

main().catch((err) => {
  console.error("\nFAILED:", (err as Error).message);
  process.exit(1);
});
