import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  draftTotals,
  elapsedSeconds,
  emptyPayload,
  expandToSets,
  formatClock,
  formatDuration,
  formatLength,
  formatRest,
  newExercise,
  newSet,
  readPayload,
  setVolumeKg,
  stopStopwatch,
  type DraftPayload,
  type DraftSet,
} from "../src/lib/live-session";
import { tonnesLifted } from "../src/lib/utils";

function session(sets: Partial<DraftSet>[]): DraftPayload {
  const exercise = newExercise("T Bar Row", "cat_tbar");
  exercise.sets = sets.map((s) => newSet(s));
  return { ...emptyPayload("KG"), exercises: [exercise] };
}

describe("what a set is worth", () => {
  it("counts only sets that were ticked off", () => {
    const done = newSet({ weight: "60", reps: "8", done: true });
    const planned = newSet({ weight: "60", reps: "8", done: false });

    assert.equal(setVolumeKg(done, "KG"), 480);
    assert.equal(setVolumeKg(planned, "KG"), 0);
  });

  it("leaves warm-ups out of the work", () => {
    const warmup = newSet({ kind: "WARMUP", weight: "20", reps: "10", done: true });
    assert.equal(setVolumeKg(warmup, "KG"), 0);
  });

  it("counts drop sets and sets to failure, which are real work", () => {
    const drop = newSet({ kind: "DROP", weight: "40", reps: "6", done: true });
    const failure = newSet({ kind: "FAILURE", weight: "50", reps: "5", done: true });

    assert.equal(setVolumeKg(drop, "KG"), 240);
    assert.equal(setVolumeKg(failure, "KG"), 250);
  });

  it("reads the typed weight in the unit the draft was written in", () => {
    const set = newSet({ weight: "100", reps: "5", done: true });
    // 100 lb is 45.36 kg, so five reps of it is a long way off 500.
    assert.equal(Math.round(setVolumeKg(set, "LB")), 227);
    assert.equal(setVolumeKg(set, "KG"), 500);
  });

  it("scores a bodyweight set at nothing rather than guessing a load", () => {
    const set = newSet({ weight: "", reps: "12", done: true });
    assert.equal(setVolumeKg(set, "KG"), 0);
  });

  it("ignores a half-typed weight instead of logging the wrong one", () => {
    const set = newSet({ weight: ".", reps: "8", done: true });
    assert.equal(setVolumeKg(set, "KG"), 0);
  });
});

describe("session totals", () => {
  it("adds each set up on its own terms", () => {
    const totals = draftTotals(
      session([
        { weight: "50", reps: "8", done: true },
        { weight: "60", reps: "6", done: true },
        { weight: "65", reps: "4", done: true },
      ]),
    );

    assert.equal(totals.volumeKg, 50 * 8 + 60 * 6 + 65 * 4);
    assert.equal(totals.sets, 3);
    assert.equal(totals.planned, 3);
  });

  it("separates sets ticked from working sets, so a warm-up still shows a tick", () => {
    const totals = draftTotals(
      session([
        { kind: "WARMUP", weight: "20", reps: "10", done: true },
        { weight: "60", reps: "6", done: true },
        { weight: "60", reps: "6", done: false },
      ]),
    );

    assert.equal(totals.ticked, 2);
    assert.equal(totals.sets, 1);
    assert.equal(totals.planned, 3);
    assert.equal(totals.volumeKg, 360);
  });

  it("is empty for a session with nothing in it", () => {
    assert.deepEqual(draftTotals(emptyPayload("KG")), {
      volumeKg: 0,
      sets: 0,
      ticked: 0,
      planned: 0,
    });
  });
});

describe("tonnage from a saved session", () => {
  it("adds a set log up set by set", () => {
    // The summary columns describe the heaviest set; no product of them
    // reaches the real figure, which is why the set log wins when it exists.
    const tonnes = tonnesLifted([
      {
        weightKg: 65,
        sets: 3,
        reps: 4,
        setLog: [
          { kind: "WORKING", weightKg: 50, reps: 8 },
          { kind: "WORKING", weightKg: 60, reps: 6 },
          { kind: "WORKING", weightKg: 65, reps: 4 },
        ],
      },
    ]);

    assert.equal(tonnes, 1.02);
  });

  it("leaves warm-up sets out of the tonnage", () => {
    const tonnes = tonnesLifted([
      {
        weightKg: 100,
        sets: 1,
        reps: 5,
        setLog: [
          { kind: "WARMUP", weightKg: 60, reps: 10 },
          { kind: "WORKING", weightKg: 100, reps: 5 },
        ],
      },
    ]);

    assert.equal(tonnes, 0.5);
  });

  it("falls back to the dictated summary when there is no set log", () => {
    assert.equal(
      tonnesLifted([{ weightKg: 60, sets: 4, reps: 8 }]),
      1.92,
    );
    assert.equal(tonnesLifted([{ weightKg: 60, sets: 4, reps: 8, setLog: [] }]), 1.92);
  });
});

describe("expanding a dictated summary into sets", () => {
  it("turns four sets of eight at sixty into four sets of eight at sixty", () => {
    const sets = expandToSets(60, 4, 8);

    assert.equal(sets.length, 4);
    assert.deepEqual(sets[0], {
      position: 0,
      kind: "WORKING",
      weightKg: 60,
      reps: 8,
      seconds: null,
    });
    assert.equal(sets[3].position, 3);
  });

  it("leaves the tonnage exactly where it was", () => {
    const summary = { weightKg: 60, sets: 4, reps: 8 };
    const expanded = expandToSets(60, 4, 8).map((s) => ({
      kind: s.kind,
      weightKg: s.weightKg,
      reps: s.reps,
    }));

    assert.equal(
      tonnesLifted([summary]),
      tonnesLifted([{ ...summary, setLog: expanded }]),
    );
  });

  it("keeps a bodyweight movement at bodyweight rather than inventing a load", () => {
    const sets = expandToSets(null, 3, 12);
    assert.equal(sets.length, 3);
    assert.equal(sets[0].weightKg, null);
    assert.equal(sets[0].reps, 12);
  });

  it("reads a missing set count as the one set it describes", () => {
    // "Lat pulldown, seventeen and a half for ten" — the parser recording no
    // count did not make it fewer than one set.
    const sets = expandToSets(17.5, null, 10);
    assert.equal(sets.length, 1);
    assert.equal(sets[0].weightKg, 17.5);
    assert.equal(sets[0].reps, 10);
  });

  it("refuses a weight with no reps, which is not a set", () => {
    assert.deepEqual(expandToSets(60, 4, null), []);
    assert.deepEqual(expandToSets(60, null, null), []);
    assert.deepEqual(expandToSets(60, 0, 8), []);
    assert.deepEqual(expandToSets(60, -2, 8), []);
  });

  it("will not expand past the ceiling a set count is allowed", () => {
    assert.equal(expandToSets(60, 50, 5).length, 50);
    assert.deepEqual(expandToSets(60, 51, 5), []);
  });
});

describe("the stopwatch on a held set", () => {
  it("counts from wall-clock, so a locked phone loses nothing", () => {
    const started = newSet({ seconds: 10, runningSince: 1_000_000 });
    assert.equal(elapsedSeconds(started, 1_000_000 + 45_000), 55);
  });

  it("reads what it banked while stopped", () => {
    const paused = newSet({ seconds: 30, runningSince: null });
    assert.equal(elapsedSeconds(paused, Date.now()), 30);
  });

  it("banks the running seconds when stopped", () => {
    const stopped = stopStopwatch(
      newSet({ seconds: 5, runningSince: 2_000_000 }),
      2_000_000 + 20_000,
    );

    assert.equal(stopped.seconds, 25);
    assert.equal(stopped.runningSince, null);
  });

  it("leaves a stopped set alone", () => {
    const set = newSet({ seconds: 12 });
    assert.equal(stopStopwatch(set, Date.now()), set);
  });
});

describe("clocks", () => {
  it("shows seconds, then m:ss, then h:mm:ss", () => {
    assert.equal(formatDuration(12), "12s");
    assert.equal(formatDuration(59), "59s");
    assert.equal(formatDuration(60), "1:00");
    assert.equal(formatDuration(605), "10:05");
    assert.equal(formatDuration(3600), "1:00:00");
    assert.equal(formatDuration(3661), "1:01:01");
  });

  it("keeps a stopwatch face at mm:ss throughout", () => {
    assert.equal(formatClock(1), "00:01");
    assert.equal(formatClock(90), "01:30");
  });

  it("speaks a finished session's length instead of ticking it", () => {
    assert.equal(formatLength(45), "45min");
    assert.equal(formatLength(60), "1h");
    assert.equal(formatLength(62), "1h 2min");
    assert.equal(formatLength(89), "1h 29min");
    assert.equal(formatLength(0), "0min");
  });

  it("names a rest interval the way a menu would", () => {
    assert.equal(formatRest(0), "Off");
    assert.equal(formatRest(45), "45s");
    assert.equal(formatRest(120), "2m");
    assert.equal(formatRest(90), "1m 30s");
  });

  it("never runs a clock backwards", () => {
    assert.equal(formatDuration(-5), "0s");
    assert.equal(formatClock(-5), "00:00");
  });
});

describe("reading a draft back out of the database", () => {
  it("keeps the unit the session was written in", () => {
    const stored = { version: 1, title: "", notes: "", unit: "LB", exercises: [] };
    assert.equal(readPayload(stored, "KG").unit, "LB");
  });

  it("falls back to the athlete's unit when the draft does not name one", () => {
    assert.equal(readPayload({ exercises: [] }, "LB").unit, "LB");
  });

  it("drops anything it cannot make sense of rather than rendering it", () => {
    const payload = readPayload(
      {
        unit: "KG",
        exercises: [
          { name: "" },
          null,
          "bench press",
          { name: "Squat", sets: [{ weight: "100", reps: "5", done: true }, 7] },
        ],
      },
      "KG",
    );

    assert.equal(payload.exercises.length, 1);
    assert.equal(payload.exercises[0].name, "Squat");
    assert.equal(payload.exercises[0].sets.length, 1);
    assert.equal(payload.exercises[0].sets[0].weight, "100");
  });

  it("treats junk as an empty session instead of throwing", () => {
    assert.deepEqual(readPayload(null, "KG"), emptyPayload("KG"));
    assert.deepEqual(readPayload("nonsense", "KG"), emptyPayload("KG"));
    assert.deepEqual(readPayload(42, "KG"), emptyPayload("KG"));
  });

  it("survives a round trip through JSON with its totals intact", () => {
    const before = session([
      { weight: "50", reps: "8", done: true },
      { kind: "WARMUP", weight: "20", reps: "10", done: true },
    ]);

    const after = readPayload(JSON.parse(JSON.stringify(before)), "KG");
    assert.deepEqual(draftTotals(after), draftTotals(before));
  });
});
