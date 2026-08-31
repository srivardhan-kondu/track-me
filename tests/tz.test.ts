import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addDaysInZone,
  dayKeyInZone,
  endOfDayInZone,
  formatTimeInZone,
  fromDateParam,
  isSameDayInZone,
  safeZone,
  startOfDayInZone,
  toDateParam,
} from "../src/lib/tz";

const IST = "Asia/Kolkata"; // UTC+5:30, no DST
const NY = "America/New_York"; // DST

describe("timezone helpers", () => {
  it("falls back to UTC for a missing or invalid zone", () => {
    assert.equal(safeZone(undefined), "UTC");
    assert.equal(safeZone(null), "UTC");
    assert.equal(safeZone("Not/AZone"), "UTC");
    assert.equal(safeZone(IST), IST);
  });

  it("starts the day at local midnight, not UTC midnight", () => {
    // 04:09 UTC is 09:39 on 31 Aug in IST, so the day began at 18:30 UTC on the 30th.
    const at = new Date("2026-08-31T04:09:00.000Z");
    assert.equal(
      startOfDayInZone(at, IST).toISOString(),
      "2026-08-30T18:30:00.000Z",
    );
    assert.equal(
      endOfDayInZone(at, IST).toISOString(),
      "2026-08-31T18:29:59.999Z",
    );
  });

  it("puts an early-morning IST log on the correct local day", () => {
    // 01:00 IST on 31 Aug is 19:30 UTC on the 30th — the naive UTC bucket
    // would file this under the 30th.
    const at = new Date("2026-08-30T19:30:00.000Z");
    assert.equal(toDateParam(at, IST), "2026-08-31");
    assert.equal(toDateParam(at, "UTC"), "2026-08-30");
  });

  it("derives the date-only weight bucket from the local date", () => {
    const at = new Date("2026-08-30T19:30:00.000Z"); // 01:00 IST on the 31st
    assert.equal(dayKeyInZone(at, IST).toISOString(), "2026-08-31T00:00:00.000Z");
    assert.equal(dayKeyInZone(at, "UTC").toISOString(), "2026-08-30T00:00:00.000Z");
  });

  it("formats times in the athlete's zone", () => {
    const at = new Date("2026-08-31T04:09:00.000Z");
    const ist = formatTimeInZone(at, IST);
    assert.ok(/9:39/.test(ist), `expected 9:39 in IST, got ${ist}`);
    const utc = formatTimeInZone(at, "UTC");
    assert.ok(/4:09/.test(utc), `expected 4:09 in UTC, got ${utc}`);
  });

  it("round-trips a date param", () => {
    const parsed = fromDateParam("2026-08-31", IST);
    assert.equal(toDateParam(parsed, IST), "2026-08-31");
  });

  it("returns today for a malformed date param", () => {
    const now = Date.now();
    assert.ok(Math.abs(fromDateParam("nonsense", IST).getTime() - now) < 5000);
    assert.ok(Math.abs(fromDateParam(undefined, IST).getTime() - now) < 5000);
  });

  it("adds days without drifting across a DST boundary", () => {
    // US DST ends 1 Nov 2026; local midnight must stay local midnight.
    const before = startOfDayInZone(new Date("2026-10-31T12:00:00Z"), NY);
    const after = addDaysInZone(before, 2, NY);
    assert.equal(toDateParam(after, NY), "2026-11-02");
    assert.equal(startOfDayInZone(after, NY).getTime(), after.getTime());
  });

  it("compares local days correctly across the UTC boundary", () => {
    const a = new Date("2026-08-30T19:00:00.000Z"); // 00:30 IST 31st
    const b = new Date("2026-08-31T10:00:00.000Z"); // 15:30 IST 31st
    assert.equal(isSameDayInZone(a, b, IST), true);
    assert.equal(isSameDayInZone(a, b, "UTC"), false);
  });
});
