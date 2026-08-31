import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { band, meanOrNull, trailingMeanByDay } from "../src/lib/series";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("trailing mean", () => {
  it("averages the window that ends on each point", () => {
    const out = trailingMeanByDay(
      [
        { day: day("2026-08-01"), value: 80 },
        { day: day("2026-08-02"), value: 82 },
        { day: day("2026-08-03"), value: 84 },
      ],
      3,
    );
    assert.equal(out[0].value, 80);
    assert.equal(out[1].value, 81);
    assert.equal(out[2].value, 82);
  });

  it("measures the window in days, so a gap thins it rather than stretching it", () => {
    // The 20th is three weeks after the others: a point-count window would
    // average it against them, a day window leaves it standing alone.
    const out = trailingMeanByDay(
      [
        { day: day("2026-08-01"), value: 100 },
        { day: day("2026-08-02"), value: 100 },
        { day: day("2026-08-20"), value: 90 },
      ],
      7,
    );
    assert.equal(out[2].value, 90);
  });

  it("sorts before smoothing, so input order cannot change the answer", () => {
    const points = [
      { day: day("2026-08-03"), value: 84 },
      { day: day("2026-08-01"), value: 80 },
      { day: day("2026-08-02"), value: 82 },
    ];
    const out = trailingMeanByDay(points, 3);
    assert.deepEqual(
      out.map((p) => p.value),
      [80, 81, 82],
    );
  });

  it("returns nothing for nothing", () => {
    assert.deepEqual(trailingMeanByDay([], 7), []);
  });
});

describe("mean or null", () => {
  it("separates no data from a zero average", () => {
    assert.equal(meanOrNull([]), null);
    assert.equal(meanOrNull([0, 0]), 0);
    assert.equal(meanOrNull([2, 4]), 3);
  });
});

describe("banding", () => {
  it("gives zero its own band, below the lowest", () => {
    assert.equal(band(0, 10, 5), -1);
    assert.equal(band(-3, 10, 5), -1);
  });

  it("spreads the rest across the steps, top value in the top band", () => {
    assert.equal(band(10, 10, 5), 4);
    assert.equal(band(1, 10, 5), 0);
    assert.equal(band(5, 10, 5), 2);
    assert.equal(band(0.1, 10, 5), 0);
  });

  it("does not divide by a zero maximum", () => {
    assert.equal(band(3, 0, 5), 0);
  });
});
