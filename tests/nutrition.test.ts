import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { estimateFromText } from "../src/services/ai/food-table";
import { analyzeMeal } from "../src/services/ai/nutrition";

/** Grams the estimator assigned to a named food. */
function grams(text: string, name: string): number {
  const { items } = estimateFromText(text);
  const item = items.find((i) => i.name === name);
  assert.ok(item, `expected "${name}" in: ${items.map((i) => i.name).join(", ")}`);
  return item.grams;
}

describe("meal quantity parsing", () => {
  it("reads explicit gram amounts", () => {
    assert.equal(grams("250g chicken breast", "Chicken breast"), 250);
    assert.equal(grams("I had 80 grams of oats", "Oats"), 80);
  });

  it("converts kilograms", () => {
    assert.equal(grams("1.2 kg chicken", "Chicken breast"), 1200);
  });

  it("counts units written as digits", () => {
    // One egg is 50 g in the table.
    assert.equal(grams("3 eggs scrambled", "Egg"), 150);
  });

  it("counts units dictated as words", () => {
    assert.equal(grams("three eggs and toast", "Egg"), 150);
    assert.equal(grams("two rotis with dal", "Roti"), 90);
  });

  it("handles containers with word numbers", () => {
    // A cup of rice is 150 g when the food defines no unit size.
    assert.equal(grams("two cups of rice", "Rice (cooked)"), 300);
    assert.equal(grams("a bowl of salad", "Vegetables"), 200);
    assert.equal(grams("one scoop of whey protein", "Whey protein"), 30);
  });

  it("falls back to a sensible default portion", () => {
    assert.equal(grams("chicken and rice", "Chicken breast"), 150);
  });

  it("totals equal the sum of the items", () => {
    const r = estimateFromText(
      "250g chicken breast with two cups of rice and a bowl of salad",
    );
    const sum = r.items.reduce((a, i) => a + i.calories, 0);
    assert.equal(r.calories, Math.round(sum));
    assert.ok(r.protein > 70, `expected a high-protein meal, got ${r.protein}`);
  });

  it("returns nothing for text with no recognisable food", () => {
    const r = estimateFromText("had a really good day today");
    assert.equal(r.items.length, 0);
    assert.equal(r.calories, 0);
  });

  it("does not count a food again inside a longer food name", () => {
    const names = (text: string) => estimateFromText(text).items.map((i) => i.name);
    assert.deepEqual(names("200g greek yogurt"), ["Greek yogurt"]);
    assert.deepEqual(names("six egg whites"), ["Egg white"]);
    assert.deepEqual(names("chicken with sweet potato"), ["Chicken breast", "Sweet potato"]);
    // Both really are there, so both count.
    assert.deepEqual(names("sweet potato and a potato").sort(), ["Potato", "Sweet potato"]);
    // The quantity still comes from the mention that counted.
    assert.equal(grams("six egg whites", "Egg white"), 198);
  });

  it("does not double-count a food mentioned twice", () => {
    const r = estimateFromText("chicken for lunch and more chicken at dinner");
    assert.equal(r.items.filter((i) => i.name === "Chicken breast").length, 1);
  });
});

describe("fibre", () => {
  it("is unknown, not zero, when the offline estimator did the scoring", async () => {
    // The food table carries no fibre figures, so the free-plan path must say
    // it does not know rather than assert a meal contained none.
    const result = await analyzeMeal({ transcript: "two rotis and dal" }, false);

    assert.equal(result.fiber, null);
    assert.equal(result.aiGenerated, false);
    // The macros it does know are still returned.
    assert.ok(result.calories > 0);
  });
});

describe("US meals on the free tier", () => {
  const names = (text: string) => estimateFromText(text).items.map((i) => i.name).sort();

  it("recognizes a typical American day", () => {
    assert.deepEqual(names("bagel with cream cheese and a latte"), ["Bagel", "Cream cheese", "Latte"]);
    assert.deepEqual(names("turkey sandwich and chips"), ["Chips", "Sandwich", "Turkey / ham"]);
    assert.deepEqual(names("chicken burrito"), ["Burrito", "Chicken breast"]);
    assert.deepEqual(names("6 buffalo wings and fries"), ["Chicken wings", "French fries"]);
    assert.deepEqual(names("a cheeseburger"), ["Burger"]);
  });

  it("does not count a food twice inside a longer name", () => {
    assert.deepEqual(names("mac and cheese"), ["Mac and cheese"]);
    assert.deepEqual(names("fried rice"), ["Fried rice"]);
    assert.deepEqual(names("orange juice"), ["Sweet drink"]);
    assert.deepEqual(names("green beans"), ["Vegetables"]);
  });

  it("reads ounces, pounds and fluid ounces", () => {
    assert.equal(grams("8 oz steak", "Beef"), 227);
    assert.equal(grams("half lb of shrimp", "Shrimp"), 100); // no digits: default portion
    assert.equal(grams("1 lb shrimp", "Shrimp"), 454);
    assert.equal(grams("16 fl oz smoothie", "Smoothie"), 473);
  });

  it("reads US kitchen measures", () => {
    assert.equal(grams("2 tbsp ranch", "Dressing / mayo"), 30);
    assert.equal(grams("two bottles of beer", "Beer"), 710);
    assert.equal(grams("2 plates of pasta", "Pasta (cooked)"), 500);
  });
});

describe("dictated US measures read back as said", () => {
  it("keeps the ounces in front of the grams", () => {
    const [item] = estimateFromText("8 oz steak").items;
    assert.equal(item.quantity, "8 oz (227 g)");
  });
});
