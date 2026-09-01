import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  groupExercises,
  mergeDictated,
  type ViewExercise,
} from "../src/lib/exercise-groups";
import { expandToSets } from "../src/lib/live-session";

function row(
  id: string,
  name: string,
  weightKg: number | null,
  sets: number | null,
  reps: number | null,
  setLog: ViewExercise["setLog"] = [],
): ViewExercise {
  return { id, name, weightKg, sets, reps, setLog };
}

function set(
  id: string,
  weightKg: number | null,
  reps: number | null,
  kind = "WORKING",
) {
  return { id, kind, weightKg, reps, seconds: null };
}

describe("regrouping a session for display", () => {
  it("puts a movement the parser split back together", () => {
    // The shape a set-by-set voice note actually produces.
    const groups = groupExercises([
      row("a", "T-Bar Row", 15, null, 15),
      row("b", "T-Bar Row", 25, 2, 13, [set("b1", 25, 13), set("b2", 25, 13)]),
      row("c", "T-Bar Row", 30, 3, 10, [
        set("c1", 30, 10),
        set("c2", 30, 10),
        set("c3", 30, 10),
      ]),
      row("d", "Lat Pulldown", 15, null, 12),
      row("e", "Lat Pulldown", 17.5, null, 11),
    ]);

    assert.equal(groups.length, 2);
    assert.equal(groups[0].name, "T-Bar Row");
    assert.equal(groups[0].sets.length, 6);
    assert.equal(groups[0].workingSets, 6);
    assert.equal(groups[0].topKg, 30);
    assert.equal(groups[1].name, "Lat Pulldown");
    assert.equal(groups[1].sets.length, 2);
  });

  it("keeps the sets in the order they were performed", () => {
    const groups = groupExercises([
      row("a", "Bench", 50, null, 8),
      row("b", "Bench", 60, null, 6),
      row("c", "Bench", 65, null, 4),
    ]);

    assert.deepEqual(
      groups[0].sets.map((s) => [s.weightKg, s.reps]),
      [
        [50, 8],
        [60, 6],
        [65, 4],
      ],
    );
  });

  it("does not weld together a movement returned to later in the session", () => {
    const groups = groupExercises([
      row("a", "Bench Press", 60, 3, 8),
      row("b", "Squat", 100, 3, 5),
      row("c", "Bench Press", 50, 2, 12),
    ]);

    assert.equal(groups.length, 3);
    assert.deepEqual(groups.map((g) => g.name), [
      "Bench Press",
      "Squat",
      "Bench Press",
    ]);
  });

  it("matches a movement across spelling and case", () => {
    const groups = groupExercises([
      row("a", "T-Bar Row", 50, null, 8),
      row("b", "t bar row", 55, null, 6),
    ]);

    assert.equal(groups.length, 1);
    assert.equal(groups[0].sets.length, 2);
    // The first spelling seen is the one shown.
    assert.equal(groups[0].name, "T-Bar Row");
  });

  it("shows a set even where only a weight was recorded", () => {
    const groups = groupExercises([row("a", "Seated Cable Row", 25, null, null)]);

    assert.equal(groups[0].sets.length, 1);
    assert.equal(groups[0].sets[0].weightKg, 25);
    assert.equal(groups[0].sets[0].reps, null);
  });

  it("counts warm-ups as sets shown but not as work", () => {
    const groups = groupExercises([
      row("a", "Squat", 100, 3, 5, [
        set("w", 40, 10, "WARMUP"),
        set("s1", 100, 5),
        set("s2", 100, 5),
      ]),
    ]);

    assert.equal(groups[0].sets.length, 3);
    assert.equal(groups[0].workingSets, 2);
    assert.equal(groups[0].topKg, 100);
  });

  it("has nothing to say about an empty session", () => {
    assert.deepEqual(groupExercises([]), []);
  });
});

describe("merging a dictated session before it is stored", () => {
  it("writes one exercise per movement, carrying every set", () => {
    const merged = mergeDictated(
      [
        { name: "T-Bar Row", weightKg: 15, sets: null, reps: 15 },
        { name: "T-Bar Row", weightKg: 25, sets: 2, reps: 13 },
        { name: "T-Bar Row", weightKg: 30, sets: 3, reps: 10 },
        { name: "Lat Pulldown", weightKg: 17.5, sets: null, reps: 10 },
      ],
      expandToSets,
    );

    assert.equal(merged.length, 2);
    assert.equal(merged[0].name, "T-Bar Row");
    assert.equal(merged[0].setLog.length, 6);
    assert.equal(merged[0].sets, 6);
    // The summary describes the heaviest set, as it does for a live session.
    assert.equal(merged[0].weightKg, 30);
    assert.equal(merged[0].reps, 10);
    assert.deepEqual(
      merged[0].setLog.map((s) => s.position),
      [0, 1, 2, 3, 4, 5],
    );
  });

  it("keeps a movement returned to later as its own block", () => {
    const merged = mergeDictated(
      [
        { name: "Bench", weightKg: 60, sets: 3, reps: 8 },
        { name: "Row", weightKg: 50, sets: 3, reps: 8 },
        { name: "Bench", weightKg: 40, sets: 2, reps: 15 },
      ],
      expandToSets,
    );

    assert.equal(merged.length, 3);
  });

  it("keeps the load of a mention that describes no countable set", () => {
    const merged = mergeDictated(
      [{ name: "Seated Cable Row", weightKg: 25, sets: null, reps: null }],
      expandToSets,
    );

    assert.equal(merged.length, 1);
    assert.equal(merged[0].setLog.length, 0);
    assert.equal(merged[0].sets, null);
    assert.equal(merged[0].weightKg, 25);
  });

  it("leaves a already-clean session alone", () => {
    const merged = mergeDictated(
      [
        { name: "Deadlift", weightKg: 140, sets: 3, reps: 5 },
        { name: "Barbell Row", weightKg: 70, sets: 4, reps: 8 },
      ],
      expandToSets,
    );

    assert.equal(merged.length, 2);
    assert.equal(merged[0].setLog.length, 3);
    assert.equal(merged[1].setLog.length, 4);
  });
});
