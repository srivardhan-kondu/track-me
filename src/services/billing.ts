import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { planUpdateFor, termForAmount, type PlanTerm } from "@/lib/entitlements";

/**
 * Turning money into access.
 *
 * Both ways in end up here — Checkout, where the buyer is known before they
 * pay, and the razorpay.me page, where they are identified only by whatever
 * email they typed — so a payment grants exactly the same thing however it
 * arrived, and is recorded the same way when it grants nothing.
 */

export type IncomingPayment = {
  /** Razorpay payment id, the idempotency key. */
  id: string;
  /** Paise. */
  amount: number;
  currency: string;
  orderId?: string | null;
  email?: string | null;
  contact?: string | null;
  note?: string | null;
  paidAt: Date;
  /** Razorpay event name, or the route that recorded it. */
  event: string;
  payload: unknown;
  /**
   * Set when the payer is already known — a Checkout order carries the id it
   * was created for. Skips email matching entirely.
   */
  userId?: string | null;
  /**
   * Addresses the payer gave. No longer used to grant anything — see the note
   * in apply() — but kept on the record so an UNMATCHED payment can be traced
   * to a person by hand.
   */
  candidateEmails?: string[];
};

export type Outcome =
  | { outcome: "duplicate"; paymentId: string }
  | { outcome: "ignored"; amount: number }
  | { outcome: "unmatched"; term: PlanTerm }
  | { outcome: "applied"; term: PlanTerm; userId: string; keptLifetime: boolean };

type Payer = {
  id: string;
  plan: "FREE" | "PREMIUM";
  planTerm: PlanTerm | null;
  planExpiresAt: Date | null;
};

const PAYER_FIELDS = {
  id: true,
  plan: true,
  planTerm: true,
  planExpiresAt: true,
} as const;

async function findPayer(
  userId: string,
): Promise<Payer | null> {
  return db.user.findUnique({ where: { id: userId }, select: PAYER_FIELDS });
}

/**
 * Records a captured payment and grants whatever it bought.
 *
 * Safe to call twice for one payment: the row is keyed on Razorpay's payment
 * id, so the second call reports a duplicate and grants nothing. That is what
 * makes it safe for Checkout to grant access on the browser callback *and* for
 * the webhook to grant it again minutes later — whichever arrives first wins,
 * and the other is a no-op.
 */
export async function recordPayment(p: IncomingPayment): Promise<Outcome> {
  const seen = await db.payment.findUnique({
    where: { id: p.id },
    select: { id: true },
  });
  if (seen) return { outcome: "duplicate", paymentId: p.id };

  try {
    return await apply(p);
  } catch (err) {
    // Lost a race with a simultaneous delivery of the same payment; the other
    // caller has already granted it.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { outcome: "duplicate", paymentId: p.id };
    }
    throw err;
  }
}

async function apply(p: IncomingPayment): Promise<Outcome> {
  const term = p.currency === "INR" ? termForAmount(p.amount) : null;

  const common = {
    id: p.id,
    amount: p.amount,
    currency: p.currency,
    orderId: p.orderId ?? null,
    email: p.email ?? null,
    contact: p.contact ?? null,
    note: p.note ?? null,
    event: p.event,
    payload: p.payload as Prisma.InputJsonValue,
    paidAt: p.paidAt,
  };

  // Not one of our prices. Recorded, but it buys nothing — this is what stops
  // a ₹1 payment through the public payment page from becoming a lifetime plan.
  if (!term) {
    await db.payment.create({ data: { ...common, status: "IGNORED" } });
    return { outcome: "ignored", amount: p.amount };
  }

  // Razorpay webhooks are account-wide, and this merchant account serves more
  // than one product. A payment from a sibling app that happens to cost the
  // same as one of our plans would otherwise be matched on the payer's email
  // and silently grant Premium, so nothing is granted automatically unless the
  // payment carries the account id we welded onto the order ourselves.
  //
  // Payments taken through the razorpay.me page carry no such id. They are
  // recorded as UNMATCHED and settled with `npm run payments claim`, which is
  // a deliberate trade: a manual step on a path we no longer sell through,
  // against never crediting the wrong person.
  const payer = p.userId
    ? await findPayer(p.userId)
    : null;

  if (!payer) {
    await db.payment.create({ data: { ...common, term, status: "UNMATCHED" } });
    return { outcome: "unmatched", term };
  }

  const update = planUpdateFor(payer, term, p.paidAt);

  await db.$transaction([
    db.payment.create({
      data: { ...common, term, status: "APPLIED", userId: payer.id },
    }),
    ...(update
      ? [db.user.update({ where: { id: payer.id }, data: update })]
      : []),
  ]);

  return {
    outcome: "applied",
    term,
    userId: payer.id,
    keptLifetime: !update,
  };
}
