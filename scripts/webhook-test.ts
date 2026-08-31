/**
 * Sends a correctly signed Razorpay webhook at our own endpoint.
 *
 *   npm run webhook:test                          ₹99 to the first user found
 *   npm run webhook:test -- --amount 99900        a lifetime purchase
 *   npm run webhook:test -- --email a@b.com       a specific payer
 *   npm run webhook:test -- --url https://…/api/webhooks/razorpay
 *
 * Razorpay's own test mode cannot reach a laptop, and razorpay.me has no test
 * mode at all, so this stands in for both: the payload shape and the signature
 * are the real ones, which is everything the endpoint actually inspects.
 */
import { createHmac, randomBytes } from "node:crypto";

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

async function main() {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not set in .env");

  const url = arg("url", "http://localhost:3000/api/webhooks/razorpay")!;
  const amount = Number(arg("amount", "9900"));
  const event = arg("event", "payment.captured")!;

  let email = arg("email");
  if (!email) {
    const user = await db.user.findFirst({
      where: { email: { not: null } },
      select: { email: true },
      orderBy: { createdAt: "asc" },
    });
    if (!user?.email) throw new Error("No users in the database — pass --email");
    email = user.email;
  }

  // Reuse an id with --id to exercise the duplicate path.
  const id = arg("id", `pay_test${randomBytes(6).toString("hex")}`)!;

  const body = JSON.stringify({
    entity: "event",
    event,
    contains: ["payment"],
    payload: {
      payment: {
        entity: {
          id,
          entity: "payment",
          amount,
          currency: "INR",
          status: "captured",
          method: "upi",
          email: "someone-else@example.com",
          contact: "+919000090000",
          // Where the payment page puts its required "Comment" field.
          notes: { comment: `Track Me — ${email}` },
          created_at: Math.floor(Date.now() / 1000),
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  });

  const signature = createHmac("sha256", secret).update(body).digest("hex");

  console.log(`POST ${url}`);
  console.log(`  ${event}  ${id}  ₹${(amount / 100).toFixed(2)}  → ${email}\n`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": signature,
    },
    body,
  });

  console.log(`HTTP ${res.status}`, await res.text());

  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { email: true, plan: true, planTerm: true, planExpiresAt: true },
  });
  console.log("\nUser now:", user ?? "(no such account)");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
