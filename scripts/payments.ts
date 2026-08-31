/**
 * Payment reconciliation.
 *
 *   npm run payments                       list unmatched payments
 *   npm run payments -- claim <id> <email> attribute one to an account
 *   npm run payments -- grant <email> <monthly|yearly|lifetime>
 *
 * `claim` settles a real payment whose payer used an email that matches no
 * account — the common case, since the payment page lets them type any address.
 * `grant` records no payment at all and exists for access sold outside the
 * gateway; prefer `claim` whenever money actually moved through Razorpay.
 */
import { PrismaClient } from "@prisma/client";

import { PRICES, planUpdateFor, type PlanTerm } from "../src/lib/entitlements";

const db = new PrismaClient();

const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

async function list() {
  const pending = await db.payment.findMany({
    where: { status: "UNMATCHED" },
    orderBy: { paidAt: "desc" },
  });

  if (pending.length === 0) {
    console.log("No unmatched payments.");
    return;
  }

  console.log(`${pending.length} unmatched payment(s):\n`);
  for (const p of pending) {
    console.log(`  ${p.id}  ${rupees(p.amount).padStart(10)}  ${p.term}`);
    console.log(`    paid    ${p.paidAt.toISOString()}`);
    console.log(`    email   ${p.email ?? "—"}   contact ${p.contact ?? "—"}`);
    console.log(`    comment ${p.note ?? "—"}`);
    console.log(`    claim   npm run payments -- claim ${p.id} <email>\n`);
  }
}

async function userByEmail(email: string) {
  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, plan: true, planTerm: true, planExpiresAt: true },
  });
  if (!user) throw new Error(`No account with the email ${email}`);
  return user;
}

function report(email: string, update: ReturnType<typeof planUpdateFor>) {
  if (!update) {
    console.log(`${email} already has a lifetime plan — left untouched.`);
    return;
  }
  const until = update.planExpiresAt
    ? `until ${update.planExpiresAt.toISOString().slice(0, 10)}`
    : "with no expiry";
  console.log(`${email} is now ${update.planTerm} ${until}.`);
}

async function claim(paymentId: string, email: string) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error(`No payment with the id ${paymentId}`);
  if (payment.status === "APPLIED") {
    throw new Error(`${paymentId} was already applied to user ${payment.userId}`);
  }
  if (!payment.term) {
    throw new Error(
      `${paymentId} is ${rupees(payment.amount)}, which is not one of our prices`,
    );
  }

  const user = await userByEmail(email);
  const update = planUpdateFor(user, payment.term, payment.paidAt);

  await db.$transaction([
    db.payment.update({
      where: { id: paymentId },
      data: { status: "APPLIED", userId: user.id },
    }),
    ...(update ? [db.user.update({ where: { id: user.id }, data: update })] : []),
  ]);

  console.log(`Claimed ${paymentId} (${rupees(payment.amount)}) for ${email}.`);
  report(email, update);
}

async function grant(email: string, termArg: string) {
  const term = termArg.toUpperCase() as PlanTerm;
  if (!(term in PRICES)) {
    throw new Error(`Unknown term "${termArg}" — use monthly, yearly or lifetime`);
  }

  const user = await userByEmail(email);
  const update = planUpdateFor(user, term, new Date());
  if (update) {
    await db.user.update({ where: { id: user.id }, data: update });
  }
  report(email, update);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case undefined:
    case "list":
      return list();
    case "claim":
      if (args.length !== 2) throw new Error("Usage: claim <paymentId> <email>");
      return claim(args[0], args[1]);
    case "grant":
      if (args.length !== 2) throw new Error("Usage: grant <email> <term>");
      return grant(args[0], args[1]);
    default:
      throw new Error(`Unknown command "${command}" — try list, claim or grant`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
