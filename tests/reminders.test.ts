import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { commentPreview, dueReminders, type ReminderState } from "../src/lib/reminders";

const NY = "America/New_York";

/** A New York wall-clock time in November (UTC−5). */
const ny = (hour: number) => new Date(Date.UTC(2026, 10, 25, hour + 5, 2));

const base: ReminderState = {
  timeZone: NY,
  remindWeighIn: true,
  remindLog: true,
  weighedInToday: false,
  loggedToday: false,
  weighInNudgedOn: null,
  logNudgedOn: null,
};

describe("daily reminders", () => {
  it("sends the weigh-in at 8 am local and the log check at 8 pm local", () => {
    assert.deepEqual(dueReminders(ny(8), base), ["weighIn"]);
    assert.deepEqual(dueReminders(ny(20), base), ["log"]);
    assert.deepEqual(dueReminders(ny(12), base), []);
  });

  it("uses the athlete's zone, not the server's", () => {
    // 08:02 in Los Angeles is 16:02 UTC.
    const la = new Date(Date.UTC(2026, 10, 25, 16, 2));
    assert.deepEqual(dueReminders(la, { ...base, timeZone: "America/Los_Angeles" }), ["weighIn"]);
    assert.deepEqual(dueReminders(la, base), []);
  });

  it("never nags about something already done", () => {
    assert.deepEqual(dueReminders(ny(8), { ...base, weighedInToday: true }), []);
    assert.deepEqual(dueReminders(ny(20), { ...base, loggedToday: true }), []);
  });

  it("respects the switches", () => {
    assert.deepEqual(dueReminders(ny(8), { ...base, remindWeighIn: false }), []);
    assert.deepEqual(dueReminders(ny(20), { ...base, remindLog: false }), []);
  });

  it("sends each nudge once a day even if the sender runs twice", () => {
    const today = new Date(Date.UTC(2026, 10, 25));
    const yesterday = new Date(Date.UTC(2026, 10, 24));
    assert.deepEqual(dueReminders(ny(8), { ...base, weighInNudgedOn: today }), []);
    assert.deepEqual(dueReminders(ny(8), { ...base, weighInNudgedOn: yesterday }), ["weighIn"]);
  });
});

describe("comment preview", () => {
  it("flattens whitespace and trims long comments", () => {
    assert.equal(commentPreview("Great\n\nsession"), "Great session");
    const long = commentPreview("x".repeat(200), 20);
    assert.equal(long.length, 20);
    assert.ok(long.endsWith("…"));
  });
});
