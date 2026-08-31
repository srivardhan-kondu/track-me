import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readMealItems, seedMealItems, totalsOf } from "../src/lib/meal-items";

/** The shape the vision model actually stores, taken from a real row. */
const STORED = [
  { fat: 6.3, name: "Roti", carbs: 45, grams: 90, protein: 8.1, calories: 267, quantity: "90 g" },
  { fat: 31.5, name: "Paneer", carbs: 1.8, grams: 150, protein: 27, calories: 398, quantity: "150 g" },
];

describe("reading a meal's stored breakdown", () => {
  it("keeps every row the model wrote", () => {
    const items = readMealItems(STORED);
    assert.equal(items.length, 2);
    assert.equal(items[0].name, "Roti");
    assert.equal(items[1].calories, 398);
  });

  it("survives a meal that was never analysed", () => {
    assert.deepEqual(readMealItems(null), []);
    assert.deepEqual(readMealItems(undefined), []);
    assert.deepEqual(readMealItems("not an array"), []);
    assert.deepEqual(readMealItems({}), []);
  });

  it("drops only the rows it cannot read, never the whole meal", () => {
    // A row missing its macros would otherwise take the good rows with it.
    const items = readMealItems([STORED[0], { name: "Mystery" }, STORED[1]]);
    assert.equal(items.length, 2);
    assert.deepEqual(
      items.map((i) => i.name),
      ["Roti", "Paneer"],
    );
  });

  it("fills in a quantity the model left off", () => {
    const [item] = readMealItems([{ ...STORED[0], quantity: undefined }]);
    assert.equal(item.quantity, "");
  });
});

describe("totals derived from the rows", () => {
  it("sums the breakdown rather than trusting a separate number", () => {
    const totals = totalsOf(readMealItems(STORED));
    assert.equal(totals.calories, 665);
    assert.equal(totals.protein, 35.1);
    assert.equal(totals.carbs, 46.8);
    assert.equal(totals.fat, 37.8);
  });

  it("is zero for a meal with nothing in it", () => {
    assert.deepEqual(totalsOf([]), {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it("follows a correction instead of keeping the old total", () => {
    // Halving the paneer must move the meal, which is the whole point of
    // deriving totals rather than storing them independently.
    const corrected = readMealItems([
      STORED[0],
      { ...STORED[1], grams: 75, calories: 199, protein: 13.5, fat: 15.75 },
    ]);
    assert.equal(totalsOf(corrected).calories, 466);
  });
});

describe("seeding an editor for a meal that was never itemised", () => {
  const legacy = {
    title: "Chicken rice bowl",
    items: null,
    calories: 680,
    protein: 52,
    carbs: 74,
    fat: 16,
  };

  it("carries the meal's own totals into one row", () => {
    // Opening the editor and saving without touching it must not zero a real
    // meal, which is what a blank row would do now that totals follow rows.
    const seeded = seedMealItems(legacy);
    assert.equal(seeded.length, 1);
    assert.equal(seeded[0].name, "Chicken rice bowl");
    assert.deepEqual(totalsOf(seeded), {
      calories: 680,
      protein: 52,
      carbs: 74,
      fat: 16,
    });
  });

  it("names the row even when the meal has no title", () => {
    assert.equal(seedMealItems({ ...legacy, title: null })[0].name, "Meal");
  });

  it("prefers the stored breakdown when there is one", () => {
    const seeded = seedMealItems({ ...legacy, items: STORED });
    assert.equal(seeded.length, 2);
    assert.equal(seeded[0].name, "Roti");
  });

  it("gives a blank row to a meal with nothing at all", () => {
    const seeded = seedMealItems({ title: null, items: null });
    assert.equal(seeded.length, 1);
    assert.equal(seeded[0].name, "");
    assert.equal(totalsOf(seeded).calories, 0);
  });
});
