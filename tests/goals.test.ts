import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_TARGET_CALORIES,
  MIN_TARGET_CALORIES,
  parseCalorieTarget,
  parseWeightTarget,
} from "../src/lib/goals";

describe("the daily calorie target", () => {
  it("reads a blank field as clearing the target, not as zero", () => {
    assert.deepEqual(parseCalorieTarget(""), { ok: true, value: null });
    assert.deepEqual(parseCalorieTarget("   "), { ok: true, value: null });
  });

  it("takes a plausible target", () => {
    assert.deepEqual(parseCalorieTarget("2400"), { ok: true, value: 2400 });
    assert.deepEqual(parseCalorieTarget(String(MIN_TARGET_CALORIES)), {
      ok: true,
      value: MIN_TARGET_CALORIES,
    });
    assert.deepEqual(parseCalorieTarget(String(MAX_TARGET_CALORIES)), {
      ok: true,
      value: MAX_TARGET_CALORIES,
    });
  });

  it("rejects a slipped key rather than storing it", () => {
    // 24000 is a mistyped 2400, and nobody eats it.
    assert.equal(parseCalorieTarget("24000").ok, false);
    assert.equal(parseCalorieTarget("12").ok, false);
    assert.equal(parseCalorieTarget("0").ok, false);
    assert.equal(parseCalorieTarget("-2400").ok, false);
    assert.equal(parseCalorieTarget("lots").ok, false);
  });

  it("rounds to whole calories", () => {
    assert.deepEqual(parseCalorieTarget("2400.6"), { ok: true, value: 2401 });
  });
});

describe("the goal weight", () => {
  it("clears on blank", () => {
    assert.deepEqual(parseWeightTarget("", "KG"), { ok: true, value: null });
  });

  it("stores kilograms whatever the athlete typed in", () => {
    assert.deepEqual(parseWeightTarget("75", "KG"), { ok: true, value: 75 });

    // 165 lb is a little under 75 kg, and what is stored is the kilograms.
    const lb = parseWeightTarget("165", "LB");
    assert.equal(lb.ok, true);
    assert.ok(lb.ok && Math.abs(lb.value! - 74.84) < 0.01);
  });

  it("refuses a weight outside the range the column holds", () => {
    assert.equal(parseWeightTarget("5", "KG").ok, false);
    assert.equal(parseWeightTarget("900", "KG").ok, false);
    assert.equal(parseWeightTarget("0", "KG").ok, false);
    assert.equal(parseWeightTarget("heavy", "KG").ok, false);
  });

  it("applies the bounds in kilograms, not in the typed unit", () => {
    // 100 lb is 45 kg — inside the stored range, though 100 would be outside
    // it if the number were taken as kilograms without converting first.
    assert.equal(parseWeightTarget("100", "LB").ok, true);
  });
});
