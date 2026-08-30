import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseWorkout } from "../src/services/ai/workout";

// No OPENAI_API_KEY is set in tests, so these exercise the regex fallback.
describe("workout parsing (offline fallback)", () => {
  it("parses the canonical dictated format", async () => {
    const r = await parseWorkout("Bench press 80kg 3 sets 8 reps");
    assert.equal(r.exercises.length, 1);
    assert.deepEqual(
      { ...r.exercises[0] },
      { name: "Bench Press", weightKg: 80, sets: 3, reps: 8 },
    );
  });

  it('understands "3 sets of 8" and "3 by 8"', async () => {
    const a = await parseWorkout("squat 100 kilos 3 sets of 8");
    assert.equal(a.exercises[0].sets, 3);
    assert.equal(a.exercises[0].reps, 8);

    const b = await parseWorkout("squat 100 kilos 4 by 6");
    assert.equal(b.exercises[0].sets, 4);
    assert.equal(b.exercises[0].reps, 6);
  });

  it("splits multiple exercises in one dictation", async () => {
    const r = await parseWorkout(
      "Bench press 80kg 3 sets of 8, then lat pulldown 60kg 3 sets of 10, then bicep curl 15kg 3x12",
    );
    assert.equal(r.exercises.length, 3);
    assert.deepEqual(
      r.exercises.map((e) => e.name),
      ["Bench Press", "Lat Pulldown", "Bicep Curl"],
    );
  });

  it("converts pounds to kilograms", async () => {
    const r = await parseWorkout("bench press 225 lbs 3 sets of 5");
    assert.ok(
      Math.abs((r.exercises[0].weightKg ?? 0) - 102.1) < 0.2,
      `expected ~102.1 kg, got ${r.exercises[0].weightKg}`,
    );
  });

  it("reads session duration in minutes and hours", async () => {
    assert.equal((await parseWorkout("squat 3x5, 45 minutes")).durationMin, 45);
    assert.equal((await parseWorkout("squat 3x5, 1.5 hours")).durationMin, 90);
  });

  it("leaves unstated fields null rather than inventing them", async () => {
    const r = await parseWorkout("did some plank");
    assert.equal(r.exercises[0].name, "Plank");
    assert.equal(r.exercises[0].weightKg, null);
    assert.equal(r.exercises[0].sets, null);
  });

  it("returns an empty session for an empty transcript", async () => {
    const r = await parseWorkout("");
    assert.equal(r.exercises.length, 0);
    assert.equal(r.title, "Workout");
  });
});
