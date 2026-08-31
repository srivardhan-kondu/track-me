/**
 * Offline fallback used when OPENAI_API_KEY is absent, so the meal pipeline is
 * demonstrable end to end without cloud credentials. Values are per 100 g
 * (or per unit where noted) and are deliberately rough — real estimates come
 * from the vision model.
 */

export type FoodFact = {
  match: RegExp;
  label: string;
  /** Grams in one "serving" when no explicit quantity is dictated. */
  defaultGrams: number;
  /** Grams represented by one countable unit ("2 eggs", "3 rotis"). */
  unitGrams?: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export const FOOD_TABLE: FoodFact[] = [
  { match: /\b(oats?|oatmeal|porridge)\b/i, label: "Oats", defaultGrams: 80, kcal: 389, protein: 16.9, carbs: 66.3, fat: 6.9 },
  { match: /\b(white |brown |basmati )?rice\b/i, label: "Rice (cooked)", defaultGrams: 200, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { match: /\b(rotis?|chapatis?|chapattis?|phulkas?)\b/i, label: "Roti", defaultGrams: 90, unitGrams: 45, kcal: 297, protein: 9, carbs: 50, fat: 7 },
  { match: /\b(naans?)\b/i, label: "Naan", defaultGrams: 90, unitGrams: 90, kcal: 310, protein: 9, carbs: 51, fat: 6 },
  { match: /\b(bread|toast|slice of bread)\b/i, label: "Bread", defaultGrams: 60, unitGrams: 30, kcal: 265, protein: 9, carbs: 49, fat: 3.2 },
  { match: /\b(chicken breast|chicken)\b/i, label: "Chicken breast", defaultGrams: 150, kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { match: /\b(egg whites?)\b/i, label: "Egg white", defaultGrams: 100, unitGrams: 33, kcal: 52, protein: 11, carbs: 0.7, fat: 0.2 },
  { match: /\b(eggs?|omelette|omelet)\b/i, label: "Egg", defaultGrams: 100, unitGrams: 50, kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
  { match: /\b(paneer)\b/i, label: "Paneer", defaultGrams: 100, kcal: 265, protein: 18, carbs: 1.2, fat: 21 },
  { match: /\b(tofu)\b/i, label: "Tofu", defaultGrams: 150, kcal: 76, protein: 8, carbs: 1.9, fat: 4.8 },
  { match: /\b(salmon)\b/i, label: "Salmon", defaultGrams: 150, kcal: 208, protein: 20, carbs: 0, fat: 13 },
  { match: /\b(tuna)\b/i, label: "Tuna", defaultGrams: 120, kcal: 132, protein: 28, carbs: 0, fat: 1 },
  { match: /\b(fish)\b/i, label: "Fish", defaultGrams: 150, kcal: 180, protein: 22, carbs: 0, fat: 9 },
  { match: /\b(mutton|lamb|goat)\b/i, label: "Mutton", defaultGrams: 150, kcal: 258, protein: 25, carbs: 0, fat: 17 },
  { match: /\b(beef|steak)\b/i, label: "Beef", defaultGrams: 150, kcal: 250, protein: 26, carbs: 0, fat: 15 },
  { match: /\b(dal|daal|lentils?)\b/i, label: "Dal", defaultGrams: 200, kcal: 116, protein: 9, carbs: 20, fat: 0.4 },
  { match: /\b(chickpeas?|chana|rajma|kidney beans?)\b/i, label: "Legumes", defaultGrams: 200, kcal: 164, protein: 8.9, carbs: 27, fat: 2.6 },
  { match: /\b(protein shakes?|whey|protein powder)\b/i, label: "Whey protein", defaultGrams: 30, unitGrams: 30, kcal: 400, protein: 80, carbs: 8, fat: 5 },
  { match: /\b(greek yogh?urt|greek curd)\b/i, label: "Greek yogurt", defaultGrams: 170, kcal: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  { match: /\b(yogh?urt|curd|dahi)\b/i, label: "Yogurt", defaultGrams: 150, kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3 },
  { match: /\b(milk)\b/i, label: "Milk", defaultGrams: 250, kcal: 62, protein: 3.2, carbs: 4.8, fat: 3.3 },
  { match: /\b(cheese)\b/i, label: "Cheese", defaultGrams: 30, kcal: 402, protein: 25, carbs: 1.3, fat: 33 },
  { match: /\b(peanut butter)\b/i, label: "Peanut butter", defaultGrams: 32, kcal: 588, protein: 25, carbs: 20, fat: 50 },
  { match: /\b(almonds?|nuts?|cashews?|walnuts?)\b/i, label: "Nuts", defaultGrams: 30, kcal: 579, protein: 21, carbs: 22, fat: 50 },
  { match: /\b(bananas?)\b/i, label: "Banana", defaultGrams: 118, unitGrams: 118, kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { match: /\b(apples?)\b/i, label: "Apple", defaultGrams: 182, unitGrams: 182, kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  { match: /\b(potato|potatoes|aloo)\b/i, label: "Potato", defaultGrams: 150, kcal: 87, protein: 2, carbs: 20, fat: 0.1 },
  { match: /\b(sweet potato)\b/i, label: "Sweet potato", defaultGrams: 150, kcal: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  { match: /\b(pastas?|spaghetti|noodles?)\b/i, label: "Pasta (cooked)", defaultGrams: 200, kcal: 158, protein: 5.8, carbs: 31, fat: 0.9 },
  { match: /\b(salad|vegetables?|veggies|sabzi|broccoli|spinach)\b/i, label: "Vegetables", defaultGrams: 150, kcal: 35, protein: 2.5, carbs: 6, fat: 0.4 },
  { match: /\b(avocados?)\b/i, label: "Avocado", defaultGrams: 100, kcal: 160, protein: 2, carbs: 9, fat: 15 },
  { match: /\b(olive oil|ghee|butter|oil)\b/i, label: "Cooking fat", defaultGrams: 10, kcal: 884, protein: 0, carbs: 0, fat: 100 },
  { match: /\b(pizzas?)\b/i, label: "Pizza", defaultGrams: 200, unitGrams: 100, kcal: 266, protein: 11, carbs: 33, fat: 10 },
  { match: /\b(burgers?)\b/i, label: "Burger", defaultGrams: 220, unitGrams: 220, kcal: 254, protein: 13, carbs: 30, fat: 9 },
  { match: /\b(biryanis?)\b/i, label: "Biryani", defaultGrams: 300, kcal: 175, protein: 7, carbs: 24, fat: 6 },
  { match: /\b(dosas?|idlis?)\b/i, label: "Dosa / Idli", defaultGrams: 150, unitGrams: 75, kcal: 168, protein: 4, carbs: 30, fat: 3.7 },
  { match: /\b(coffee|tea|chai)\b/i, label: "Tea / Coffee", defaultGrams: 200, kcal: 30, protein: 1, carbs: 3.5, fat: 1.2 },
  { match: /\b(juice|soda|coke|cola)\b/i, label: "Sweet drink", defaultGrams: 250, kcal: 45, protein: 0.2, carbs: 11, fat: 0.1 },
];

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  a: 1, an: 1, couple: 2, few: 3,
  half: 0.5, quarter: 0.25,
};

/** Matches "3", "2.5", "three" or "a" — athletes dictate all of these. */
const COUNT = `(\\d+(?:\\.\\d+)?|${Object.keys(NUMBER_WORDS).join("|")})`;

function toNumber(raw: string): number {
  const word = NUMBER_WORDS[raw.toLowerCase()];
  return word !== undefined ? word : parseFloat(raw);
}

/** Typical gram weight of a "cup"/"bowl"/"scoop" when the food has no unit size. */
const CONTAINER_GRAMS: Record<string, number> = {
  cup: 150,
  bowl: 200,
  glass: 250,
  scoop: 30,
  handful: 30,
  plate: 250,
  tablespoon: 15,
  teaspoon: 5,
};

/**
 * Finds the quantity dictated immediately before a food mention, e.g.
 * "200g chicken", "2 eggs", "three rotis", "two cups of rice".
 */
function quantityFor(text: string, fact: FoodFact): number {
  const idx = text.search(fact.match);
  if (idx < 0) return fact.defaultGrams;

  // Look at the characters preceding the food word.
  const before = text.slice(Math.max(0, idx - 34), idx).toLowerCase();

  const grams = before.match(/(\d+(?:\.\d+)?)\s*(?:g|gram|grams|gm)\b\s*(?:of\s+)?$/);
  if (grams) return parseFloat(grams[1]);

  const kilos = before.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?)\b\s*(?:of\s+)?$/);
  if (kilos) return parseFloat(kilos[1]) * 1000;

  const ml = before.match(/(\d+(?:\.\d+)?)\s*(?:ml|millilitres?|milliliters?)\b\s*(?:of\s+)?$/);
  if (ml) return parseFloat(ml[1]);

  // "two cups of", "a bowl of", "1 scoop of"
  const container = before.match(
    new RegExp(
      `${COUNT}\\s*(cups?|bowls?|glass(?:es)?|scoops?|handfuls?|plates?|tablespoons?|teaspoons?)\\b\\s*(?:of\\s+)?$`,
      "i",
    ),
  );
  if (container) {
    const n = toNumber(container[1]);
    const unit = container[2].replace(/e?s$/i, "").toLowerCase();
    const per = fact.unitGrams ?? CONTAINER_GRAMS[unit] ?? 150;
    if (Number.isFinite(n) && n > 0) return n * per;
  }

  // A bare count: "2 eggs", "three rotis", "a banana"
  const count = before.match(
    new RegExp(`${COUNT}\\s*(?:pieces?|slices?|nos?\\.?)?\\s*(?:of\\s+)?$`, "i"),
  );
  if (count) {
    const n = toNumber(count[1]);
    if (Number.isFinite(n) && n > 0 && n < 50) {
      return n * (fact.unitGrams ?? fact.defaultGrams);
    }
  }

  return fact.defaultGrams;
}

export type EstimatedItem = {
  name: string;
  quantity: string;
  /** Portion in grams (or ml for liquids) — the basis for every figure below. */
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** Keyword-and-quantity estimate over a meal description. */
export function estimateFromText(text: string): {
  items: EstimatedItem[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  const items: EstimatedItem[] = [];
  const seen = new Set<string>();

  for (const fact of FOOD_TABLE) {
    if (!fact.match.test(text) || seen.has(fact.label)) continue;
    seen.add(fact.label);

    const grams = quantityFor(text, fact);
    const k = grams / 100;
    items.push({
      name: fact.label,
      quantity: `${Math.round(grams)} g`,
      grams: Math.round(grams),
      calories: Math.round(fact.kcal * k),
      protein: Math.round(fact.protein * k * 10) / 10,
      carbs: Math.round(fact.carbs * k * 10) / 10,
      fat: Math.round(fact.fat * k * 10) / 10,
    });
  }

  const sum = (pick: (i: EstimatedItem) => number) =>
    Math.round(items.reduce((acc, i) => acc + pick(i), 0) * 10) / 10;

  return {
    items,
    calories: Math.round(sum((i) => i.calories)),
    protein: sum((i) => i.protein),
    carbs: sum((i) => i.carbs),
    fat: sum((i) => i.fat),
  };
}
