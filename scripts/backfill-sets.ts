/**
 * Expands every dictated exercise in the database into the sets it describes.
 *
 * Before set-by-set logging, an exercise was one row: "60 kg, 4 sets, 8 reps".
 * That is a precise claim about four sets, so expanding it into four rows
 * invents nothing — it just stores what was already said in the shape the
 * rest of the app now reads. Tonnage is unchanged by construction (w x n x r
 * is the same number as n copies of w x r), and so are personal records,
 * because n identical candidate sets have the same best as one.
 *
 * What it deliberately leaves alone:
 *
 *   - Exercises that already have a set log. Re-running this is a no-op, so a
 *     half-finished run can simply be run again.
 *   - Exercises with no set count, or with sets but no reps. Three rows
 *     reading "60" would assert three sets nobody ever described.
 *
 * Usage:
 *   npm run sets:backfill              # dry run — counts only, writes nothing
 *   npm run sets:backfill -- --apply   # writes, and records what it touched
 *   npm run sets:backfill -- --rollback <file>
 */

import { readFile, writeFile } from "node:fs/promises";

import { db } from "../src/lib/db";
import { expandToSets } from "../src/lib/live-session";

/** Exercises read per round trip. Small enough to stay well inside memory. */
const PAGE = 500;
/** Set rows per insert. */
const CHUNK = 1000;

type Receipt = {
  at: string;
  exerciseIds: string[];
  setsWritten: number;
};

async function rollback(path: string) {
  const receipt = JSON.parse(await readFile(path, "utf8")) as Receipt;

  console.log(
    `Rolling back ${receipt.setsWritten} sets across ${receipt.exerciseIds.length} exercises (written ${receipt.at})`,
  );

  let removed = 0;
  for (let i = 0; i < receipt.exerciseIds.length; i += CHUNK) {
    const batch = receipt.exerciseIds.slice(i, i + CHUNK);
    const { count } = await db.exerciseSet.deleteMany({
      where: { exerciseId: { in: batch } },
    });
    removed += count;
  }

  console.log(`Removed ${removed} set rows.`);
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");

  const rollbackAt = args.indexOf("--rollback");
  if (rollbackAt !== -1) {
    const path = args[rollbackAt + 1];
    if (!path) throw new Error("--rollback needs the receipt file to undo");
    await rollback(path);
    return;
  }

  console.log(apply ? "Backfilling set logs…" : "Dry run — nothing is written.");

  const touched: string[] = [];
  let scanned = 0;
  let skippedHasLog = 0;
  let skippedTooVague = 0;
  let setsWritten = 0;
  let cursor: string | undefined;

  for (;;) {
    const page = await db.exercise.findMany({
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        weightKg: true,
        sets: true,
        reps: true,
        _count: { select: { setLog: true } },
      },
    });

    if (page.length === 0) break;
    cursor = page[page.length - 1].id;
    scanned += page.length;

    const rows: {
      exerciseId: string;
      position: number;
      kind: "WORKING";
      weightKg: number | null;
      reps: number | null;
      seconds: null;
    }[] = [];

    for (const ex of page) {
      if (ex._count.setLog > 0) {
        skippedHasLog += 1;
        continue;
      }

      const expanded = expandToSets(ex.weightKg, ex.sets, ex.reps);
      if (expanded.length === 0) {
        skippedTooVague += 1;
        continue;
      }

      touched.push(ex.id);
      setsWritten += expanded.length;
      for (const set of expanded) {
        rows.push({
          exerciseId: ex.id,
          position: set.position,
          kind: "WORKING",
          weightKg: set.weightKg,
          reps: set.reps,
          seconds: null,
        });
      }
    }

    if (apply && rows.length > 0) {
      for (let i = 0; i < rows.length; i += CHUNK) {
        await db.exerciseSet.createMany({ data: rows.slice(i, i + CHUNK) });
      }
    }

    process.stdout.write(`\r  scanned ${scanned}…`);
  }

  process.stdout.write("\r");

  console.log(`  exercises scanned      ${scanned}`);
  console.log(`  already had a set log  ${skippedHasLog}`);
  console.log(`  too vague to expand    ${skippedTooVague}`);
  console.log(`  expanded               ${touched.length}`);
  console.log(`  set rows               ${setsWritten}`);

  if (!apply) {
    console.log("\nNothing written. Re-run with --apply to commit.");
    return;
  }

  const receipt: Receipt = {
    at: new Date().toISOString(),
    exerciseIds: touched,
    setsWritten,
  };
  const path = `backfill-sets-${Date.now()}.json`;
  await writeFile(path, JSON.stringify(receipt));

  console.log(`\nWritten. Receipt: ${path}`);
  console.log(`Undo with: npm run sets:backfill -- --rollback ${path}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
