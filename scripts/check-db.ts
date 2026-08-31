/**
 * Validates DATABASE_URL / DIRECT_URL and reports what is actually there.
 * Run after pointing .env at a new database: `npm run db:check`.
 */
import { PrismaClient } from "@prisma/client";

function describe(raw: string | undefined, label: string) {
  if (!raw) {
    console.log(`  ${label.padEnd(12)} (not set)`);
    return;
  }
  try {
    const u = new URL(raw);
    const pooled =
      u.hostname.includes("-pooler") || u.port === "6543" ? " [pooled]" : "";
    console.log(
      `  ${label.padEnd(12)} ${u.hostname}:${u.port || "5432"}${u.pathname}${pooled}`,
    );
  } catch {
    console.log(`  ${label.padEnd(12)} (unparseable — check the quoting)`);
  }
}

function diagnose(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("authentication") || m.includes("password"))
    return "The username or password is wrong.";
  if (m.includes("enotfound") || m.includes("getaddrinfo"))
    return "The host does not resolve. Check for a typo or a missing region in the hostname.";
  if (m.includes("etimedout") || m.includes("timeout"))
    return "The connection timed out. Check the provider allows connections from your IP.";
  if (m.includes("does not exist"))
    return "The database name in the URL does not exist on that server.";
  if (m.includes("ssl") || m.includes("tls"))
    return "TLS negotiation failed. Hosted providers usually need `?sslmode=require`.";
  if (m.includes("ecconnrefused") || m.includes("econnrefused"))
    return "Connection refused — nothing is listening there. Is the container running?";
  return "";
}

async function main() {
  console.log("\nConnection targets:");
  describe(process.env.DATABASE_URL, "DATABASE_URL");
  describe(process.env.DIRECT_URL, "DIRECT_URL");

  const db = new PrismaClient();

  try {
    const version = await db.$queryRaw<
      { version: string }[]
    >`SELECT version()`;
    console.log(`\n  connected  ${version[0].version.split(",")[0]}`);
  } catch (err) {
    const message = (err as Error).message;
    console.error("\n  FAILED to connect.\n");
    const hint = diagnose(message);
    if (hint) console.error(`  ${hint}\n`);
    console.error(message.split("\n").slice(0, 4).join("\n"));
    await db.$disconnect();
    process.exit(1);
  }

  try {
    const [users, meals, workouts, weights, photos, comments] =
      await Promise.all([
        db.user.count(),
        db.meal.count(),
        db.workout.count(),
        db.weightEntry.count(),
        db.progressPhoto.count(),
        db.comment.count(),
      ]);

    console.log("\nContents:");
    console.log(`  users          ${users}`);
    console.log(`  meals          ${meals}`);
    console.log(`  workouts       ${workouts}`);
    console.log(`  weigh-ins      ${weights}`);
    console.log(`  progress pics  ${photos}`);
    console.log(`  comments       ${comments}`);

    if (users === 0) {
      console.log("\n  Schema is present but empty. Run: npm run db:seed");
    }
    console.log("");
  } catch {
    console.log(
      "\n  Connected, but the Track Me tables are missing.\n  Run: npm run db:push && npm run db:seed\n",
    );
  }

  await db.$disconnect();
}

main();
