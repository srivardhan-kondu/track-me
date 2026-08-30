import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { estimateFromText } from "../src/services/ai/food-table";

/** Grams the estimator assigned to a named food. */
function grams(text: string, name: string): number {
  const { items } = estimateFromText(text);
  const item = items.find((i) => i.name === name);
  assert.ok(item, `expected "${name}" in: ${items.map((i) => i.name).join(", ")}`);
  return parseFloat(item.quantity);
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

  it("does not double-count a food mentioned twice", () => {
    const r = estimateFromText("chicken for lunch and more chicken at dinner");
    assert.equal(r.items.filter((i) => i.name === "Chicken breast").length, 1);
  });
});
