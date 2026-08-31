/**
 * Admin access, from the command line.
 *
 *   npm run admin                     list every admin
 *   npm run admin -- grant <email>    give an account the console
 *   npm run admin -- revoke <email>   take it away
 *
 * The console can do both of these itself. This exists for the case it cannot
 * help with: the first admin on a fresh deployment, and the morning after
 * somebody removed the last one. Setting ADMIN_EMAILS in the environment does
 * the same job without a database round trip, and is the better answer for a
 * deployment whose admins never change.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function list() {
  const admins = await db.user.findMany({
    where: { isAdmin: true },
    select: { email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(/[,\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);

  if (admins.length === 0) {
    console.log("No account has the isAdmin column set.");
  } else {
    console.log(`${admins.length} admin account(s):\n`);
    for (const admin of admins) {
      console.log(`  ${admin.email ?? "—"}  ${admin.name ?? ""}`);
    }
  }

  console.log(
    allowlist.length > 0
      ? `\nADMIN_EMAILS also grants: ${allowlist.join(", ")}`
      : "\nADMIN_EMAILS is unset, so the column above is the only way in.",
  );
}

async function set(email: string, isAdmin: boolean) {
  const user = await db.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!user) throw new Error(`No account with the email ${email}`);

  if (!isAdmin) {
    const others = await db.user.count({
      where: { isAdmin: true, id: { not: user.id } },
    });
    if (others === 0 && !process.env.ADMIN_EMAILS) {
      throw new Error(
        `${user.email} is the last admin and ADMIN_EMAILS is unset — ` +
          "revoking would leave no way into the console.",
      );
    }
  }

  await db.user.update({ where: { id: user.id }, data: { isAdmin } });
  console.log(`${user.email} ${isAdmin ? "is now an admin" : "is no longer an admin"}.`);
}

async function main() {
  const [command, email] = process.argv.slice(2);

  switch (command) {
    case undefined:
    case "list":
      return list();
    case "grant":
      if (!email) throw new Error("Usage: grant <email>");
      return set(email, true);
    case "revoke":
      if (!email) throw new Error("Usage: revoke <email>");
      return set(email, false);
    default:
      throw new Error(`Unknown command "${command}" — try list, grant or revoke`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
