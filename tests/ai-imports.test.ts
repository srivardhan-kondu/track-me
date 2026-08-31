import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * The AI service modules must not reach the database client through their
 * imports.
 *
 * This is a design rule with a history. Spend accounting was first written as
 * a single module that imported `db`, and the AI services imported that. The
 * Prisma client bundled dotenv at the time, so importing it read `.env` as a
 * side effect and populated `process.env` — and `aiEnabled` was a
 * module-load-time constant derived from `OPENAI_API_KEY`. Adding one import
 * to one file therefore switched the offline fallback off, and the tests that
 * exist to exercise that fallback started making real, billed API calls
 * against the production key.
 *
 * Two things guard against it now. `aiEnabled` reads the environment at call
 * time, so no import order can freeze it. And the pricing maths lives apart
 * from the ledger, so a service can cost a call without taking a database
 * with it. This test enforces the second.
 *
 * Checked structurally rather than by observing the side effect: Prisma no
 * longer loads `.env` on import, so a side-effect test would pass whatever
 * the imports looked like — which is precisely the kind of guard that reports
 * safety it is not measuring.
 */

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

/** Every module specifier a file imports, static and dynamic. */
function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specifiers: string[] = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

/** Resolves a specifier to a file on disk, or null if it leaves the project. */
function resolve(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(SRC, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(fromFile), specifier);
  else return null; // a package, not our code

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && !candidate.endsWith(path.sep)) {
      try {
        if (readFileSync(candidate)) return candidate;
      } catch {
        // a directory; keep looking
      }
    }
  }
  return null;
}

/** Every project file reachable from `entry`, and the path that got there. */
function reachableFrom(entry: string): Map<string, string[]> {
  const seen = new Map<string, string[]>([[entry, [entry]]]);
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.shift()!;
    const trail = seen.get(file)!;

    for (const specifier of importsOf(file)) {
      const target = resolve(specifier, file);
      if (!target || seen.has(target)) continue;
      seen.set(target, [...trail, target]);
      queue.push(target);
    }
  }
  return seen;
}

const rel = (f: string) => path.relative(ROOT, f);

const SERVICES = [
  "src/services/ai/nutrition.ts",
  "src/services/ai/workout.ts",
  "src/services/ai/transcribe.ts",
  "src/services/ai/client.ts",
  "src/services/ai/pricing.ts",
  "src/services/ai/retry.ts",
];

describe("ai services stay clear of the database", () => {
  for (const service of SERVICES) {
    it(`${path.basename(service)} does not import the db client`, () => {
      const reached = reachableFrom(path.join(ROOT, service));
      const db = [...reached.keys()].find((f) => rel(f) === "src/lib/db.ts");

      assert.equal(
        db,
        undefined,
        db
          ? `${service} reaches the database via ` +
            reached.get(db)!.map(rel).join(" → ") +
            ". Charging belongs in the caller; see this file's comment."
          : "",
      );
    });
  }

  it("proves the walk would catch it, via the module that does import db", () => {
    // budget.ts is allowed to import the database — it is the ledger. If this
    // ever stops finding it, the walk above has stopped working and every
    // assertion in this file is passing vacuously.
    const reached = reachableFrom(path.join(ROOT, "src/services/ai/budget.ts"));
    assert.ok(
      [...reached.keys()].some((f) => rel(f) === "src/lib/db.ts"),
      "the import walk no longer reaches db.ts from budget.ts, so it is not " +
        "actually checking anything",
    );
  });

  it("keeps the callers that do the charging on the database side", () => {
    // processing.ts is where cost is recorded, and it already has db.
    const reached = reachableFrom(path.join(ROOT, "src/services/processing.ts"));
    const files = [...reached.keys()].map(rel);
    assert.ok(files.includes("src/lib/db.ts"));
    assert.ok(files.includes("src/services/ai/budget.ts"));
  });
});
