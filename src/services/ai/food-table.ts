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
  { match: /\b(chickpeas?|chana|rajma|kidney beans?|black beans?|pinto beans?|refried beans|beans)\b/i, label: "Legumes", defaultGrams: 200, kcal: 164, protein: 8.9, carbs: 27, fat: 2.6 },
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
  { match: /\b(salad|vegetables?|veggies|sabzi|broccoli|spinach|green beans|asparagus|zucchini|carrots?)\b/i, label: "Vegetables", defaultGrams: 150, kcal: 35, protein: 2.5, carbs: 6, fat: 0.4 },
  { match: /\b(avocados?)\b/i, label: "Avocado", defaultGrams: 100, kcal: 160, protein: 2, carbs: 9, fat: 15 },
  { match: /\b(olive oil|ghee|butter|oil)\b/i, label: "Cooking fat", defaultGrams: 10, kcal: 884, protein: 0, carbs: 0, fat: 100 },
  { match: /\b(pizzas?)\b/i, label: "Pizza", defaultGrams: 200, unitGrams: 100, kcal: 266, protein: 11, carbs: 33, fat: 10 },
  { match: /\b((?:ham|cheese|veggie )?burgers?)\b/i, label: "Burger", defaultGrams: 220, unitGrams: 220, kcal: 254, protein: 13, carbs: 30, fat: 9 },
  { match: /\b(biryanis?)\b/i, label: "Biryani", defaultGrams: 300, kcal: 175, protein: 7, carbs: 24, fat: 6 },
  { match: /\b(dosas?|idlis?)\b/i, label: "Dosa / Idli", defaultGrams: 150, unitGrams: 75, kcal: 168, protein: 4, carbs: 30, fat: 3.7 },
  /*
    What a US plate is made of. Without these, the free tier — which never
    reaches the model — fails an American athlete on their first breakfast.
    Per 100 g, from USDA FoodData Central figures, rounded.
  */
  { match: /\b(bagels?)\b/i, label: "Bagel", defaultGrams: 105, unitGrams: 105, kcal: 257, protein: 10, carbs: 50, fat: 1.6 },
  { match: /\b(cream cheese)\b/i, label: "Cream cheese", defaultGrams: 30, kcal: 342, protein: 6, carbs: 4, fat: 34 },
  { match: /\b(cottage cheese)\b/i, label: "Cottage cheese", defaultGrams: 113, kcal: 98, protein: 11, carbs: 3.4, fat: 4.3 },
  { match: /\b(cereal|cheerios|corn ?flakes|frosted flakes)\b/i, label: "Cereal", defaultGrams: 40, kcal: 379, protein: 7, carbs: 84, fat: 3 },
  { match: /\b(granola)\b/i, label: "Granola", defaultGrams: 55, kcal: 471, protein: 10, carbs: 64, fat: 20 },
  { match: /\b(pancakes?|waffles?|french toast)\b/i, label: "Pancakes / waffles", defaultGrams: 150, unitGrams: 75, kcal: 227, protein: 6.4, carbs: 28, fat: 9.7 },
  { match: /\b(bacon)\b/i, label: "Bacon", defaultGrams: 24, unitGrams: 8, kcal: 541, protein: 37, carbs: 1.4, fat: 42 },
  { match: /\b(sausages?|bratwursts?)\b/i, label: "Sausage", defaultGrams: 100, unitGrams: 50, kcal: 301, protein: 12, carbs: 2, fat: 27 },
  { match: /\b(turkey|ham|deli meat|cold cuts)\b/i, label: "Turkey / ham", defaultGrams: 85, unitGrams: 28, kcal: 120, protein: 19, carbs: 2, fat: 4 },
  { match: /\b(fried chicken|chicken tenders?|chicken nuggets?|nuggets?)\b/i, label: "Fried chicken", defaultGrams: 150, unitGrams: 18, kcal: 280, protein: 18, carbs: 15, fat: 17 },
  { match: /\b((?:chicken |buffalo )?wings?)\b/i, label: "Chicken wings", defaultGrams: 190, unitGrams: 32, kcal: 290, protein: 27, carbs: 0, fat: 19 },
  { match: /\b(shrimp|prawns?)\b/i, label: "Shrimp", defaultGrams: 100, kcal: 99, protein: 24, carbs: 0.2, fat: 0.3 },
  { match: /\b(sandwich(?:es)?|subs?|hoagies?|wraps?|blt|pb ?(?:&|and) ?j)\b/i, label: "Sandwich", defaultGrams: 220, unitGrams: 220, kcal: 250, protein: 12, carbs: 28, fat: 10 },
  { match: /\b(burritos?|burrito bowls?)\b/i, label: "Burrito", defaultGrams: 300, unitGrams: 300, kcal: 206, protein: 9, carbs: 25, fat: 8 },
  { match: /\b(tacos?)\b/i, label: "Taco", defaultGrams: 200, unitGrams: 100, kcal: 226, protein: 9, carbs: 20, fat: 12 },
  { match: /\b(tortillas?)\b/i, label: "Tortilla", defaultGrams: 45, unitGrams: 45, kcal: 310, protein: 8, carbs: 50, fat: 8 },
  { match: /\b(hot ?dogs?)\b/i, label: "Hot dog", defaultGrams: 100, unitGrams: 100, kcal: 290, protein: 10, carbs: 24, fat: 17 },
  { match: /\b(mac (?:and|n|&) cheese|macaroni)\b/i, label: "Mac and cheese", defaultGrams: 200, kcal: 164, protein: 6.5, carbs: 20, fat: 6.6 },
  { match: /\b(fried rice)\b/i, label: "Fried rice", defaultGrams: 200, kcal: 168, protein: 6, carbs: 21, fat: 6 },
  { match: /\b(sushi|california rolls?)\b/i, label: "Sushi", defaultGrams: 200, unitGrams: 30, kcal: 150, protein: 5.5, carbs: 28, fat: 1.5 },
  { match: /\b(quinoa)\b/i, label: "Quinoa (cooked)", defaultGrams: 185, kcal: 120, protein: 4.4, carbs: 21, fat: 1.9 },
  { match: /\b(french fries|fries|tater tots)\b/i, label: "French fries", defaultGrams: 117, kcal: 312, protein: 3.4, carbs: 41, fat: 15 },
  { match: /\b((?:potato |tortilla )?chips|doritos|pretzels?)\b/i, label: "Chips", defaultGrams: 28, kcal: 536, protein: 7, carbs: 53, fat: 35 },
  { match: /\b(popcorn)\b/i, label: "Popcorn", defaultGrams: 30, kcal: 430, protein: 9, carbs: 62, fat: 17 },
  { match: /\b(ranch|salad dressing|dressing|mayo|mayonnaise)\b/i, label: "Dressing / mayo", defaultGrams: 30, kcal: 450, protein: 1, carbs: 6, fat: 47 },
  { match: /\b(protein bars?|granola bars?|quest bars?|clif bars?)\b/i, label: "Protein bar", defaultGrams: 60, unitGrams: 60, kcal: 333, protein: 33, carbs: 37, fat: 12 },
  { match: /\b(cookies?)\b/i, label: "Cookie", defaultGrams: 30, unitGrams: 15, kcal: 488, protein: 5, carbs: 64, fat: 24 },
  { match: /\b(donuts?|doughnuts?)\b/i, label: "Donut", defaultGrams: 60, unitGrams: 60, kcal: 452, protein: 5, carbs: 51, fat: 25 },
  { match: /\b(muffins?)\b/i, label: "Muffin", defaultGrams: 113, unitGrams: 113, kcal: 377, protein: 5, carbs: 51, fat: 17 },
  { match: /\b(ice cream|froyo|frozen yogh?urt)\b/i, label: "Ice cream", defaultGrams: 66, kcal: 207, protein: 3.5, carbs: 24, fat: 11 },
  { match: /\b(chocolate|candy bar)\b/i, label: "Chocolate", defaultGrams: 40, kcal: 546, protein: 5, carbs: 61, fat: 31 },
  { match: /\b(berries|blueberries|strawberries|raspberries)\b/i, label: "Berries", defaultGrams: 150, kcal: 50, protein: 0.8, carbs: 12, fat: 0.3 },
  { match: /\b(oranges?(?! juice)|grapes)\b/i, label: "Orange / grapes", defaultGrams: 130, unitGrams: 130, kcal: 55, protein: 0.8, carbs: 14, fat: 0.2 },
  { match: /\b(smoothies?)\b/i, label: "Smoothie", defaultGrams: 450, kcal: 60, protein: 1.5, carbs: 13, fat: 0.5 },
  { match: /\b(lattes?|cappuccinos?|frappuccinos?|mochas?)\b/i, label: "Latte", defaultGrams: 355, kcal: 45, protein: 2.4, carbs: 4.5, fat: 1.8 },
  { match: /\b(beers?)\b/i, label: "Beer", defaultGrams: 355, unitGrams: 355, kcal: 43, protein: 0.5, carbs: 3.6, fat: 0 },
  { match: /\b(wine)\b/i, label: "Wine", defaultGrams: 150, unitGrams: 150, kcal: 83, protein: 0.1, carbs: 2.7, fat: 0 },
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
  tbsp: 15,
  tsp: 5,
  can: 355,
  bottle: 500,
};

/**
 * A portion dictated in a US measure keeps the athlete's own words in front
 * of the grams — "8 oz (227 g)" — so the meal reads back the way it was said.
 */
type Portion = { grams: number; label?: string };
const said = (grams: number, measure: string): Portion => ({
  grams,
  label: `${measure} (${Math.round(grams)} g)`,
});

/**
 * Finds the quantity dictated immediately before a food mention, e.g.
 * "200g chicken", "2 eggs", "three rotis", "two cups of rice".
 */
function quantityFor(text: string, fact: FoodFact, idx: number): number | Portion {
  if (idx < 0) return fact.defaultGrams;

  // Look at the characters preceding the food word.
  const before = text.slice(Math.max(0, idx - 34), idx).toLowerCase();

  const grams = before.match(/(\d+(?:\.\d+)?)\s*(?:g|gram|grams|gm)\b\s*(?:of\s+)?$/);
  if (grams) return parseFloat(grams[1]);

  const kilos = before.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?)\b\s*(?:of\s+)?$/);
  if (kilos) return parseFloat(kilos[1]) * 1000;

  // US measures. A dictated "6 oz steak" means weight; "12 oz latte" or
  // "16 fl oz" is a volume — both come out as grams-or-millilitres.
  const flOz = before.match(/(\d+(?:\.\d+)?)\s*(?:fl\.?\s*oz|fluid ounces?)\b\.?\s*(?:of\s+)?$/);
  if (flOz) return said(parseFloat(flOz[1]) * 29.57, `${flOz[1]} fl oz`);

  const oz = before.match(/(\d+(?:\.\d+)?)\s*(?:oz|ounces?)\b\.?\s*(?:of\s+)?$/);
  if (oz) return said(parseFloat(oz[1]) * 28.35, `${oz[1]} oz`);

  const lb = before.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\b\.?\s*(?:of\s+)?$/);
  if (lb) return said(parseFloat(lb[1]) * 453.6, `${lb[1]} lb`);

  const ml = before.match(/(\d+(?:\.\d+)?)\s*(?:ml|milliliters?|millilitres?)\b\s*(?:of\s+)?$/);
  if (ml) return parseFloat(ml[1]);

  // "two cups of", "a bowl of", "1 scoop of"
  const container = before.match(
    new RegExp(
      `${COUNT}\\s*(cups?|bowls?|glass(?:es)?|scoops?|handfuls?|plates?|tablespoons?|teaspoons?|tbsps?|tsps?|cans?|bottles?)\\b\\s*(?:of\\s+)?$`,
      "i",
    ),
  );
  if (container) {
    const n = toNumber(container[1]);
    // "glasses" sheds "es" but "plates" and "bottles" only shed the "s", so
    // try the candidates against the table rather than guess the plural rule.
    const word = container[2].toLowerCase();
    const unit = [word, word.replace(/s$/, ""), word.replace(/es$/, "")].find(
      (w) => w in CONTAINER_GRAMS,
    );
    const per = fact.unitGrams ?? (unit ? CONTAINER_GRAMS[unit] : undefined) ?? 150;
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
  /** Only the vision model returns this; the table below has no fibre data. */
  fiber?: number;
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

  // Every place each food is mentioned. "Greek yogurt" also contains
  // "yogurt", "egg whites" contains "egg" and "sweet potato" contains
  // "potato"; a mention lying wholly inside a longer mention of a different
  // food belongs to that food, or the meal is counted twice.
  const spans = FOOD_TABLE.map((fact) =>
    [...text.matchAll(new RegExp(fact.match.source, fact.match.flags.replace("g", "") + "g"))].map(
      (m) => ({ start: m.index!, end: m.index! + m[0].length }),
    ),
  );
  const shadowed = (i: number, s: { start: number; end: number }) =>
    spans.some((other, j) =>
      j !== i &&
      other.some((o) => o.start <= s.start && o.end >= s.end && o.end - o.start > s.end - s.start),
    );

  for (const [i, fact] of FOOD_TABLE.entries()) {
    const own = spans[i].find((s) => !shadowed(i, s));
    if (!own || seen.has(fact.label)) continue;
    seen.add(fact.label);

    const found = quantityFor(text, fact, own.start);
    const { grams, label } = typeof found === "number" ? { grams: found, label: undefined } : found;
    const k = grams / 100;
    items.push({
      name: fact.label,
      quantity: label ?? `${Math.round(grams)} g`,
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
