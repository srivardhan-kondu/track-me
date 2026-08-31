import { z } from "zod";

/**
 * One line of a meal's breakdown, as the vision model returns it and as the
 * athlete may correct it.
 *
 * Defined here rather than beside either consumer because three places now
 * agree on this shape: the analysis that produces it, the table that edits it,
 * and the action that stores it.
 */
export const MealItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  /** Free text as spoken — "1 cup", "2 rotis", "200 g". */
  quantity: z.string().trim().max(40).default(""),
  grams: z.coerce.number().min(0).max(5000).default(0),
  calories: z.coerce.number().min(0).max(5000),
  protein: z.coerce.number().min(0).max(500),
  carbs: z.coerce.number().min(0).max(500),
  fat: z.coerce.number().min(0).max(500),
});

export type MealItem = z.infer<typeof MealItemSchema>;

/** Anything stored in `Meal.items`, read back defensively. */
export function readMealItems(raw: unknown): MealItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const parsed = MealItemSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export type MealTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/**
 * The meal's totals are the sum of its lines — never a separately edited
 * number. The analysis prompt already requires the two to agree, so deriving
 * them here means a correction to one ingredient cannot leave the total
 * describing a meal nobody ate.
 */
export function totalsOf(items: MealItem[]): MealTotals {
  const sum = items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return {
    calories: Math.round(sum.calories),
    protein: Math.round(sum.protein * 10) / 10,
    carbs: Math.round(sum.carbs * 10) / 10,
    fat: Math.round(sum.fat * 10) / 10,
  };
}

/**
 * The rows to open an editor with.
 *
 * A meal analysed before the breakdown was stored — or by a model that
 * returned totals without lines — has macros but no items. Seeding that with a
 * blank row would be destructive: the totals are derived from the rows, so
 * saving an untouched form would zero a real meal. Its own totals become one
 * row instead, which preserves the meal and still lets it be split up.
 */
export function seedMealItems(meal: {
  title?: string | null;
  items?: unknown;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}): MealItem[] {
  const stored = readMealItems(meal.items);
  if (stored.length > 0) return stored;

  const calories = meal.calories ?? 0;
  const protein = meal.protein ?? 0;
  const carbs = meal.carbs ?? 0;
  const fat = meal.fat ?? 0;

  if (calories > 0 || protein > 0 || carbs > 0 || fat > 0) {
    return [
      {
        name: meal.title?.trim() || "Meal",
        quantity: "",
        grams: 0,
        calories,
        protein,
        carbs,
        fat,
      },
    ];
  }

  return [
    { name: "", quantity: "", grams: 0, calories: 0, protein: 0, carbs: 0, fat: 0 },
  ];
}
