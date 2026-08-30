import { z } from "zod";

import { aiEnabled, openai, VISION_MODEL } from "./client";
import { estimateFromText, type EstimatedItem } from "./food-table";

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
};

const ItemSchema = z.object({
  name: z.string(),
  quantity: z.string(),
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
        required: ["name", "quantity", "calories", "protein", "carbs", "fat"],
        properties: {
          name: { type: "string" },
          quantity: {
            type: "string",
            description: "Estimated portion, e.g. '150 g' or '2 eggs'.",
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

You receive a photo of the meal and/or the athlete's spoken description of it. Identify each food item, estimate its portion size, and compute calories and macros.

Rules:
- Prefer the spoken description for quantities when it states them; use the photo to judge portion size otherwise.
- Estimate rather than refuse. An approximate number is far more useful here than no number.
- Totals must equal the sum of the per-item values.
- Use grams for protein, carbs and fat; kcal for calories.
- Infer the meal slot from the food and context when it is obvious, otherwise return null.`;

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
  };
}

/**
 * Estimates meal nutrition from a photo and/or a description.
 * Falls back to the offline estimator when no API key is configured.
 */
export async function analyzeMeal(input: {
  transcript?: string | null;
  image?: { buffer: Buffer; contentType: string } | null;
}): Promise<NutritionResult> {
  const transcript = input.transcript?.trim() ?? "";

  if (!aiEnabled) return fallback(transcript);

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

  const res = await openai().chat.completions.create({
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
    max_tokens: 1500,
  });

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
  };
}
