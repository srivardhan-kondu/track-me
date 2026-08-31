import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { csvCell, neutralizeFormula, toCsv } from "../src/lib/csv";

describe("csv export escaping", () => {
  it("defuses every formula prefix a spreadsheet would execute", () => {
    // The meal title is written by a vision model reading the user's own
    // photo, and the file is opened by their coach.
    for (const prefix of ["=", "+", "-", "@"]) {
      const payload = `${prefix}HYPERLINK("http://evil.test","claim")`;
      assert.equal(neutralizeFormula(payload), `'${payload}`);
    }
  });

  it("leaves ordinary text alone", () => {
    assert.equal(neutralizeFormula("Chicken and rice"), "Chicken and rice");
    assert.equal(neutralizeFormula("2 eggs + toast"), "2 eggs + toast");
    assert.equal(neutralizeFormula(""), "");
  });

  it("defuses before quoting, so the apostrophe survives the quotes", () => {
    const cell = csvCell('=cmd|"/c calc"!A1');
    assert.ok(cell.startsWith("\"'="), `expected a quoted defusal, got ${cell}`);
  });

  it("still quotes cells that would break the row apart", () => {
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
    assert.equal(csvCell("one,two"), '"one,two"');
    assert.equal(csvCell("line\nbreak"), '"line\nbreak"');
  });

  it("renders empty values as empty rather than as the word null", () => {
    assert.equal(csvCell(null), "");
    assert.equal(csvCell(undefined), "");
  });

  it("writes a header row from the first record's keys", () => {
    const csv = toCsv([
      { name: "Squat", reps: 5 },
      { name: "=Bench", reps: 8 },
    ]);
    assert.equal(csv, "name,reps\nSquat,5\n'=Bench,8");
  });

  it("returns nothing for no rows", () => {
    assert.equal(toCsv([]), "");
  });
});
