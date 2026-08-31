import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchPayment, verifyCheckoutSignature } from "@/lib/razorpay";
import { currentUser } from "@/lib/session";
import { recordPayment } from "@/services/billing";

/**
 * Closes a purchase: the payment sheet hands the browser three ids, and this
 * turns them into access.
 *
 * Nothing here trusts the browser. The signature proves Razorpay issued the
 * pair, and the amount and captured/authorised state are read back from the
 * API rather than accepted from the client. The webhook grants the same
 * payment independently, so this endpoint is an optimisation — it makes access
 * appear before the sheet closes — and never the only path.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = parsed.data;

  if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
    console.warn(`[checkout] bad signature on ${paymentId} from ${user.id}`);
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  let payment;
  try {
    payment = await fetchPayment(paymentId);
  } catch (err) {
    console.error("[checkout] could not read the payment back", err);
    // The webhook will still land, so this is a delay rather than a loss.
    return NextResponse.json({ outcome: "pending" });
  }

  if (payment.order_id !== orderId) {
    return NextResponse.json({ error: "Order mismatch" }, { status: 400 });
  }

  // Auto-capture is a per-account setting. Where it is off the money is only
  // held, and granting now would hand out access for a payment that may yet be
  // voided — the webhook grants it when capture actually happens.
  if (payment.status !== "captured") {
    return NextResponse.json({ outcome: "pending", status: payment.status });
  }

  // The order was created for a specific account; the signed ids say which.
  // Falling back to the caller only covers an order made before notes existed.
  const userId = payment.notes?.userId ?? user.id;

  const result = await recordPayment({
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    orderId,
    email: payment.email,
    contact: payment.contact,
    note: payment.notes?.comment ?? null,
    paidAt: new Date(payment.created_at * 1000),
    event: "checkout.verified",
    payload: payment,
    userId,
  });

  return NextResponse.json(result);
}
