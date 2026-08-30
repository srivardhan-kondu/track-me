import { z } from "zod";

import { aiEnabled, openai, VISION_MODEL } from "./client";

export type ParsedExercise = {
  name: string;
  weightKg: number | null;
  sets: number | null;
  reps: number | null;
};

export type WorkoutResult = {
  title: string;
  durationMin: number | null;
  exercises: ParsedExercise[];
  aiGenerated: boolean;
};

const ResponseSchema = z.object({
  title: z.string(),
  durationMin: z.number().nullable(),
  exercises: z.array(
    z.object({
      name: z.string(),
      weightKg: z.number().nullable(),
      sets: z.number().nullable(),
      reps: z.number().nullable(),
    }),
  ),
});

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "durationMin", "exercises"],
  properties: {
    title: {
      type: "string",
      description: "Short session name, e.g. 'Push day' or 'Legs'.",
    },
    durationMin: { type: ["number", "null"] },
    exercises: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "weightKg", "sets", "reps"],
        properties: {
          name: { type: "string" },
          weightKg: {
            type: ["number", "null"],
            description: "Working weight in kilograms; null for bodyweight.",
          },
          sets: { type: ["number", "null"] },
          reps: {
            type: ["number", "null"],
            description: "Reps per set. If reps vary, use the typical value.",
          },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You convert an athlete's spoken workout log into structured data.

The athlete dictates exercises loosely, for example: "bench press 80 kilos 3 sets of 8, then incline dumbbell press 30s for 3 by 10".

Rules:
- Return one entry per exercise, in the order dictated.
- Convert pounds to kilograms when the athlete uses lbs (1 lb = 0.4536 kg).
- "3 by 10" and "3 sets of 10" both mean sets=3, reps=10.
- Use null for anything not stated; never invent numbers.
- Give the session a short title based on the movements (e.g. "Push day", "Legs", "Full body").`;

const KNOWN_MOVEMENTS = [
  "bench press", "incline bench", "incline press", "decline press", "overhead press",
  "shoulder press", "military press", "chest press", "dumbbell press", "chest fly",
  "lat pulldown", "pull up", "pull ups", "chin up", "barbell row", "dumbbell row",
  "cable row", "seated row", "deadlift", "romanian deadlift", "rdl", "squat",
  "front squat", "back squat", "leg press", "leg extension", "leg curl",
  "hamstring curl", "calf raise", "lunge", "lunges", "bulgarian split squat",
  "hip thrust", "bicep curl", "hammer curl", "preacher curl", "tricep pushdown",
  "tricep extension", "skull crusher", "lateral raise", "front raise", "rear delt fly",
  "shrug", "face pull", "plank", "crunch", "sit up", "leg raise", "russian twist",
  "dip", "dips", "push up", "push ups", "treadmill", "cycling", "rowing",
];

/** Regex parser used when no API key is configured. */
function fallbackParse(transcript: string): WorkoutResult {
  const text = transcript.trim();
  if (!text) {
    return { title: "Workout", durationMin: null, exercises: [], aiGenerated: false };
  }

  const durMatch = text.match(
    /(\d+(?:\.\d+)?)\s*(?:min|mins|minutes?)\b/i,
  );
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i);
  let durationMin: number | null = durMatch ? Math.round(parseFloat(durMatch[1])) : null;
  if (!durationMin && hourMatch) durationMin = Math.round(parseFloat(hourMatch[1]) * 60);

  // Split on separators an athlete naturally uses between exercises.
  const chunks = text
    .split(/(?:,|\.|;|\bthen\b|\bnext\b|\band then\b|\n)+/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const exercises: ParsedExercise[] = [];

  for (const chunk of chunks) {
    const lower = chunk.toLowerCase();
    const movement = KNOWN_MOVEMENTS.find((m) => lower.includes(m));
    if (!movement) continue;

    let weightKg: number | null = null;
    const kg = chunk.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?)\b/i);
    const lbs = chunk.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\b/i);
    if (kg) weightKg = parseFloat(kg[1]);
    else if (lbs) weightKg = Math.round(parseFloat(lbs[1]) * 0.4536 * 10) / 10;

    let sets: number | null = null;
    let reps: number | null = null;

    // "3 sets of 8" / "3 sets 8 reps"
    const setsOf = chunk.match(
      /(\d+)\s*sets?\s*(?:of|x|by|\*)?\s*(\d+)?\s*(?:reps?)?/i,
    );
    // "3 x 8" / "3 by 8"
    const byForm = chunk.match(/(\d+)\s*(?:x|by|\*)\s*(\d+)/i);

    if (setsOf) {
      sets = parseInt(setsOf[1], 10);
      if (setsOf[2]) reps = parseInt(setsOf[2], 10);
    } else if (byForm) {
      sets = parseInt(byForm[1], 10);
      reps = parseInt(byForm[2], 10);
    }

    if (reps === null) {
      const repsOnly = chunk.match(/(\d+)\s*reps?\b/i);
      if (repsOnly) reps = parseInt(repsOnly[1], 10);
    }

    exercises.push({
      name: movement.replace(/\b\w/g, (c) => c.toUpperCase()),
      weightKg,
      sets,
      reps,
    });
  }

  const title =
    exercises.length > 0
      ? `${exercises[0].name} session`
      : "Workout";

  return { title, durationMin, exercises, aiGenerated: false };
}

/** Converts a dictated workout into structured exercises. */
export async function parseWorkout(
  transcript: string | null | undefined,
): Promise<WorkoutResult> {
  const text = transcript?.trim() ?? "";

  if (!aiEnabled) return fallbackParse(text);
  if (!text) {
    return { title: "Workout", durationMin: null, exercises: [], aiGenerated: false };
  }

  const res = await openai().chat.completions.create({
    model: VISION_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "workout_log",
        strict: true,
        schema: JSON_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    max_tokens: 1200,
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("Model returned an empty response");

  const parsed = ResponseSchema.parse(JSON.parse(raw));
  return {
    title: parsed.title || "Workout",
    durationMin: parsed.durationMin,
    exercises: parsed.exercises,
    aiGenerated: true,
  };
}
