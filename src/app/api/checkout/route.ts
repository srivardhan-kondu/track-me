import { NextResponse } from "next/server";
import { z } from "zod";

import { PRICES } from "@/lib/entitlements";
import { enforce, rateLimitResponse, RateLimited } from "@/lib/rate-limit";
import { checkoutEnabled, createOrder, keyId, liveMode } from "@/lib/razorpay";
import { currentUser } from "@/lib/session";

/**
 * Opens a purchase: creates the Razorpay order the payment sheet charges
 * against, and hands the browser everything it needs to render the sheet.
 *
 * The price is read from our own table rather than the request body, so the
 * amount is never something the client can propose.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  term: z.enum(["MONTHLY", "YEARLY", "LIFETIME"]),
});

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkoutEnabled) {
    return NextResponse.json(
      { error: "Payments are not configured on this deployment" },
      { status: 503 },
    );
  }

  // Every call creates a real order on the Razorpay account.
  try {
    await enforce("checkout", user.id, "Too many payment attempts.");
  } catch (err) {
    if (err instanceof RateLimited) return rateLimitResponse(err);
    throw err;
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const { term } = parsed.data;
  const amount = PRICES[term];

  try {
    const order = await createOrder({
      amount,
      // Razorpay caps the receipt at 40 characters.
      receipt: `tm_${term.toLowerCase()}_${user.id}`.slice(0, 40),
      // What makes Checkout self-identifying: the webhook and the verify step
      // both read the account to credit straight off the payment.
      notes: { userId: user.id, term, email: user.email ?? "" },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      liveMode,
      term,
      prefill: { name: user.name ?? "", email: user.email ?? "" },
    });
  } catch (err) {
    console.error("[checkout] could not create an order", err);
    return NextResponse.json(
      { error: "Could not start the payment. Try again in a moment." },
      { status: 502 },
    );
  }
}
