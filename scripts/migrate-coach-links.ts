/**
 * Decides what happens to coach links that already exist.
 *
 * The consent change defaults every CoachAthlete row to PENDING, which is the
 * safe direction: those rows were created unilaterally, by a coach typing an
 * email address, with no involvement from the athlete at all. Treating them as
 * authorisation is precisely the hole that was closed.
 *
 * That does mean any coaching relationship already in the database stops
 * working until the athlete allows it. Run this to see what is affected:
 *
 *   npm run links:audit
 *
 * If — and only if — you can vouch for the existing links (a handful of test
 * accounts, or relationships you set up yourself and know both sides agreed
 * to), grandfather them:
 *
 *   npm run links:audit -- --accept-existing
 *
 * On a real user base, do not. Let the athletes accept; that is the point.
 */

import { db } from "../src/lib/db";

const ACCEPT = process.argv.includes("--accept-existing");

async function main() {
  const links = await db.coachAthlete.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      coachId: true,
      athleteId: true,
      status: true,
      createdAt: true,
      coach: { select: { email: true } },
      athlete: { select: { email: true } },
    },
  });

  if (links.length === 0) {
    console.log("No coach links exist. Nothing to migrate.");
    return;
  }

  const pending = links.filter((l) => l.status === "PENDING");

  console.log(`${links.length} coach link(s):\n`);
  for (const link of links) {
    console.log(
      `  ${link.status.padEnd(9)} ${link.coach.email ?? link.coachId}` +
        ` → ${link.athlete.email ?? link.athleteId}` +
        `  (created ${link.createdAt.toISOString().slice(0, 10)})`,
    );
  }

  if (!ACCEPT) {
    console.log(
      `\n${pending.length} link(s) are PENDING and grant no access.` +
        "\nThe athlete allows them from Settings → Your coach." +
        "\nTo grandfather them instead: npm run links:audit -- --accept-existing",
    );
    return;
  }

  const { count } = await db.coachAthlete.updateMany({
    where: { status: "PENDING" },
    data: { status: "ACCEPTED", respondedAt: new Date() },
  });

  console.log(`\nGrandfathered ${count} link(s) to ACCEPTED.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
