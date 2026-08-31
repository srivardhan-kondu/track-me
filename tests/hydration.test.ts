import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_WATER_GOAL_ML,
  MAX_WATER_GOAL_ML,
  MIN_WATER_GOAL_ML,
  formatWater,
  hydrationPct,
  litres,
  metGoal,
  remainingMl,
  waterGoal,
} from "../src/lib/hydration";

describe("water goal", () => {
  it("falls back to the default when nothing is stored", () => {
    assert.equal(waterGoal(null), DEFAULT_WATER_GOAL_ML);
    assert.equal(waterGoal(undefined), DEFAULT_WATER_GOAL_ML);
    assert.equal(waterGoal(0), DEFAULT_WATER_GOAL_ML);
    assert.equal(waterGoal(Number.NaN), DEFAULT_WATER_GOAL_ML);
  });

  it("keeps a stored goal, clamped to the range the form allows", () => {
    assert.equal(waterGoal(2500), 2500);
    assert.equal(waterGoal(100), MIN_WATER_GOAL_ML);
    assert.equal(waterGoal(99_000), MAX_WATER_GOAL_ML);
  });
});

describe("formatting", () => {
  it("speaks millilitres below a litre and litres above it", () => {
    assert.equal(formatWater(0), "0 ml");
    assert.equal(formatWater(250), "250 ml");
    assert.equal(formatWater(999), "999 ml");
    assert.equal(formatWater(1000), "1 L");
    assert.equal(formatWater(2350), "2.4 L");
  });

  it("rounds litres to one place", () => {
    assert.equal(litres(2350), 2.4);
    assert.equal(litres(3000), 3);
    assert.equal(litres(1240), 1.2);
  });
});

describe("progress against the goal", () => {
  it("caps the share at 100 so a big day cannot overflow a track", () => {
    assert.equal(hydrationPct(1500, 3000), 50);
    assert.equal(hydrationPct(3000, 3000), 100);
    assert.equal(hydrationPct(9000, 3000), 100);
    assert.equal(hydrationPct(0, 3000), 0);
  });

  it("treats a goal of zero as met by anything at all", () => {
    assert.equal(hydrationPct(1, 0), 100);
    assert.equal(hydrationPct(0, 0), 0);
  });

  it("counts the goal as met on the nose, and reports what is left", () => {
    assert.equal(metGoal(3000, 3000), true);
    assert.equal(metGoal(2999, 3000), false);
    assert.equal(remainingMl(2750, 3000), 250);
    assert.equal(remainingMl(4000, 3000), 0);
  });
});
