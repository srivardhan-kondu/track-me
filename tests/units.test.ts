import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  displayVolume,
  displayWeight,
  feetInches,
  formatHeight,
  formatVolume,
  formatWeight,
  formatTonnage,
  formatWeightDelta,
  fromFeetInches,
  toKg,
  toMl,
  unitPrefs,
  weightBounds,
} from "../src/lib/units";

describe("preferences", () => {
  it("falls back to metric for anything it cannot read", () => {
    assert.deepEqual(unitPrefs(null), {
      weight: "KG",
      height: "CM",
      volume: "ML",
    });
    assert.deepEqual(
      unitPrefs({ weightUnit: "STONE", heightUnit: null, volumeUnit: "" }),
      { weight: "KG", height: "CM", volume: "ML" },
    );
    assert.deepEqual(
      unitPrefs({ weightUnit: "LB", heightUnit: "FT", volumeUnit: "FL_OZ" }),
      { weight: "LB", height: "FT", volume: "FL_OZ" },
    );
  });
});

describe("weight", () => {
  it("shows kilograms untouched and pounds converted", () => {
    assert.equal(formatWeight(76.4, "KG"), "76.4 kg");
    assert.equal(formatWeight(76.4, "LB"), "168.4 lb");
    assert.equal(formatWeight(null, "LB"), "—");
  });

  it("keeps the decimal, rather than rounding a check-in to whole units", () => {
    assert.equal(displayWeight(77.05, "KG"), 77.1);
    assert.equal(displayWeight(77.05, "KG", 2), 77.05);
    assert.equal(toKg(169.9, "LB"), 77.07);
    assert.equal(toKg(77.05, "KG"), 77.05);
  });

  it("survives the round trip back to the column it came from", () => {
    for (const kg of [20, 56.7, 77.05, 120.35, 400]) {
      const shown = displayWeight(kg, "LB");
      assert.ok(Math.abs(toKg(shown, "LB") - kg) < 0.05, `${kg} kg drifted`);
    }
  });

  it("signs a change and gives kilograms the finer place", () => {
    assert.equal(formatWeightDelta(-0.35, "KG"), "-0.35");
    assert.equal(formatWeightDelta(0.5, "KG"), "+0.5");
    assert.equal(formatWeightDelta(-0.35, "LB"), "-0.8");
  });

  it("states form bounds in the unit on screen, inside the stored range", () => {
    assert.deepEqual(weightBounds("KG"), { min: 20, max: 400, step: 0.01 });
    const lb = weightBounds("LB");
    assert.equal(lb.min, 45);
    assert.equal(lb.max, 881);
    assert.ok(toKg(lb.min, "LB") >= 20 && toKg(lb.max, "LB") <= 400);
  });
});

describe("height", () => {
  it("carries twelve inches into a foot instead of saying 5 foot 12", () => {
    assert.deepEqual(feetInches(180.34), { feet: 5, inches: 11 });
    assert.deepEqual(feetInches(152.4), { feet: 5, inches: 0 });
    // 71.65 inches rounds to 72, which is six feet exactly — never 5′ 12″.
    assert.deepEqual(feetInches(182), { feet: 6, inches: 0 });
  });

  it("formats in the unit asked for", () => {
    assert.equal(formatHeight(175, "CM"), "175 cm");
    assert.equal(formatHeight(175, "FT"), "5′ 9″");
    assert.equal(formatHeight(null, "FT"), "—");
  });

  it("rebuilds centimetres from feet and inches", () => {
    assert.equal(fromFeetInches(5, 9), 175.3);
    assert.equal(fromFeetInches(6, 0), 182.9);
  });
});

describe("volume", () => {
  it("converts to whole fluid ounces", () => {
    assert.equal(displayVolume(500, "FL_OZ"), 17);
    assert.equal(displayVolume(500, "ML"), 500);
    assert.equal(toMl(16, "FL_OZ"), 473);
    assert.equal(toMl(500, "ML"), 500);
  });

  it("switches metric to litres, and leaves ounces alone", () => {
    assert.equal(formatVolume(750, "ML"), "750 ml");
    assert.equal(formatVolume(2350, "ML"), "2.4 L");
    assert.equal(formatVolume(0, "ML"), "0 ml");
    assert.equal(formatVolume(2350, "FL_OZ"), "79 fl oz");
  });
});

describe("tonnage", () => {
  it("states a big total the way each unit's lifters do", () => {
    assert.equal(formatTonnage(12_400, "KG"), "12.4 t");
    assert.equal(formatTonnage(12_400, "LB"), "27.3k lb");
    assert.equal(formatTonnage(400, "LB"), "882 lb");
    assert.equal(formatTonnage(0, "KG"), "0 t");
  });
});
