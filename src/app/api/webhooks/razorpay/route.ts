import { NextResponse } from "next/server";

import { extractPayment, verifySignature } from "@/lib/razorpay";
import { recordPayment } from "@/services/billing";

/**
 * Razorpay webhook receiver.
 *
 * Configure in Dashboard → Settings → Webhooks against `payment.captured` and
 * `payment_link.paid`, with separate URLs and secrets for test and live mode.
 *
 * This is the authoritative path. Checkout also grants access from the browser
 * callback, but a phone that dies between paying and returning never makes
 * that call — this one still arrives, and recordPayment makes the overlap a
 * no-op either way.
 *
 * The endpoint is account-wide: every payment the merchant account takes lands
 * here, not only Track Me's. Anything whose amount is not exactly one of our
 * prices is recorded and ignored.
 */

// Signature verification needs node:crypto and the unparsed body.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[razorpay] RAZORPAY_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-razorpay-signature"), secret)) {
    console.warn("[razorpay] rejected a payload with a bad signature");
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }

  const payment = extractPayment(body);
  // An event we do not handle is still a delivery we accept; anything but a
  // 2xx has Razorpay redeliver it until it gives up.
  if (!payment) return NextResponse.json({ outcome: "skipped" });

  const result = await recordPayment({
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    orderId: payment.orderId,
    email: payment.email,
    contact: payment.contact,
    note: payment.note,
    paidAt: payment.paidAt,
    event: (body as { event: string }).event,
    payload: body,
    // Checkout welds the account onto the order; the payment page cannot, so
    // those fall through to matching on whatever email was typed.
    userId: payment.userId,
    candidateEmails: payment.candidateEmails,
  });

  if (result.outcome === "unmatched") {
    console.warn(
      `[razorpay] ${payment.id} (${result.term}) matches no account; tried ${
        payment.candidateEmails.join(", ") || "no addresses"
      }`,
    );
  }

  return NextResponse.json(result);
}
