import { z } from "zod";

import { aiEnabled, openai, VISION_MODEL } from "./client";
import { chatCostUnits } from "./pricing";
import { estimateFromText, type EstimatedItem } from "./food-table";
import { withRetry } from "./retry";

export type MealSlotValue = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

export type NutritionResult = {
  title: string;
  slot: MealSlotValue | null;
  items: EstimatedItem[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** True when a real vision model produced the estimate. */
  aiGenerated: boolean;
  /** What the call cost, for the caller to record. Zero for the fallback. */
  costUnits: number;
};

const ItemSchema = z.object({
  name: z.string(),
  quantity: z.string(),
  grams: z.number(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
});

const ResponseSchema = z.object({
  title: z.string(),
  slot: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]).nullable(),
  items: z.array(ItemSchema),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
});

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "slot", "items", "calories", "protein", "carbs", "fat"],
  properties: {
    title: {
      type: "string",
      description: "Short name for the meal, e.g. 'Chicken and rice'.",
    },
    slot: {
      type: ["string", "null"],
      enum: ["BREAKFAST", "LUNCH", "DINNER", "SNACK", null],
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "grams", "calories", "protein", "carbs", "fat"],
        properties: {
          name: { type: "string" },
          quantity: {
            type: "string",
            description:
              "How the portion was described, with the gram weight in brackets, e.g. '1 scoop (30 g)'.",
          },
          grams: {
            type: "number",
            description:
              "The portion as a number of grams (or millilitres for liquids). Required for every item.",
          },
          calories: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
        },
      },
    },
    calories: { type: "number", description: "Total kcal for the whole meal." },
    protein: { type: "number", description: "Total protein in grams." },
    carbs: { type: "number", description: "Total carbohydrate in grams." },
    fat: { type: "number", description: "Total fat in grams." },
  },
} as const;

const SYSTEM_PROMPT = `You are a sports nutritionist estimating the macronutrient content of a meal for an athlete's training log.

You receive a photo of the meal and/or the athlete's spoken description of it.

The athlete logs the same meals repeatedly and their coach reads the trend, so
CONSISTENCY MATTERS MORE THAN PRECISION. The identical description must always
produce the identical numbers. Work mechanically, not impressionistically.

Method — follow it exactly, every time:
1. List each distinct food item.
2. Commit to a portion in GRAMS (millilitres for liquids) for every item. Never
   leave a portion as a vague unit. If the athlete stated grams, use their
   number. If they used a household unit, convert it with the reference table
   below. If nothing is stated, use the standard serving from the table.
3. Apply standard reference macros per 100 g for that food.
4. Compute each item's calories and macros from its gram weight.
5. Sum the items to get the totals. The totals MUST equal the sum of the items.

Reference weights for household units — use these exact values:
- 1 scoop whey protein = 30 g
- 1 scoop / serving of oats = 40 g dry
- 1 medium banana = 120 g
- 1 medium apple = 180 g
- 1 large egg = 50 g
- 1 slice of bread = 30 g
- 1 roti / chapati = 45 g
- 1 cup cooked rice = 160 g
- 1 cup cooked pasta = 200 g
- 1 bowl of vegetables / salad = 150 g
- 1 cup / glass of milk = 240 ml
- 1 tablespoon of oil, ghee or butter = 14 g
- 1 teaspoon of oil, ghee or butter = 5 g
- 1 tablespoon of peanut butter = 16 g
- 1 handful of nuts = 30 g
- 1 palm-sized portion of meat or fish = 120 g

Other rules:
- Quantities the athlete states always win over anything the photo suggests.
- Estimate rather than refuse. An approximate number is far more useful than none.
- Report protein, carbs and fat in grams; calories in kcal.
- Infer the meal slot when it is obvious, otherwise return null.
- If nothing in the input is food, return an empty item list and zero totals.`;

function fallback(transcript: string): NutritionResult {
  const est = estimateFromText(transcript || "");
  return {
    title: est.items[0]?.name
      ? est.items.map((i) => i.name).slice(0, 3).join(", ")
      : "Logged meal",
    slot: null,
    items: est.items,
    calories: est.calories,
    protein: est.protein,
    carbs: est.carbs,
    fat: est.fat,
    aiGenerated: false,
    costUnits: 0,
  };
}

/**
 * Estimates meal nutrition from a photo and/or a description.
 * Falls back to the offline estimator when no API key is configured, or when
 * the athlete is on the free plan — logging still works, it is the analysis
 * that is paid for.
 */
export async function analyzeMeal(
  input: {
    transcript?: string | null;
    image?: { buffer: Buffer; contentType: string } | null;
  },
  useAi: boolean = aiEnabled(),
): Promise<NutritionResult> {
  const transcript = input.transcript?.trim() ?? "";

  if (!useAi || !aiEnabled()) return fallback(transcript);

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [];

  content.push({
    type: "text",
    text: transcript
      ? `The athlete described this meal: "${transcript}"`
      : "The athlete did not describe this meal; estimate it from the photo alone.",
  });

  if (input.image) {
    const b64 = input.image.buffer.toString("base64");
    content.push({
      type: "image_url",
      image_url: { url: `data:${input.image.contentType};base64,${b64}` },
    });
  }

  const res = await withRetry("analyzeMeal", () =>
    openai().chat.completions.create({
      model: VISION_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "meal_nutrition",
          strict: true,
          schema: JSON_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      // The same meal must score the same every time, or the coach is reading
      // sampling noise instead of a trend.
      temperature: 0,
      seed: 1,
      max_tokens: 1500,
    }),
  );

  // Charge before parsing: the tokens were spent whether or not the response
  // turns out to be usable.
  const costUnits = chatCostUnits(res.usage);

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("Vision model returned an empty response");

  const parsed = ResponseSchema.parse(JSON.parse(raw));

  return {
    title: parsed.title || "Logged meal",
    slot: parsed.slot,
    items: parsed.items,
    calories: parsed.calories,
    protein: parsed.protein,
    carbs: parsed.carbs,
    fat: parsed.fat,
    aiGenerated: true,
    costUnits,
  };
}
