import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay webhook plumbing: proving a request really came from Razorpay, and
 * reducing the two payload shapes we subscribe to down to one flat record.
 */

/** Events that carry a captured payment we care about. */
const HANDLED = new Set(["payment.captured", "payment_link.paid"]);

/**
 * Verifies the `X-Razorpay-Signature` header: HMAC-SHA256 over the request
 * body, keyed with the webhook secret.
 *
 * `raw` must be the untouched request text. Parsing the JSON and re-encoding
 * it changes key order and whitespace, and the digest no longer matches.
 */
export function verifySignature(
  raw: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;

  const expected = createHmac("sha256", secret).update(raw).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "hex");
  } catch {
    return false;
  }

  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // digest length; check first and compare only equal-length buffers.
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

export type CapturedPayment = {
  /** Razorpay payment id, `pay_...`. */
  id: string;
  /** Paise. */
  amount: number;
  currency: string;
  email: string | null;
  contact: string | null;
  /** The payment page's required "Comment" field, when present. */
  note: string | null;
  /** Razorpay order id, present only for Checkout purchases. */
  orderId: string | null;
  /**
   * The account to credit, welded onto the order at creation time. Present for
   * Checkout, absent for the razorpay.me page — which is exactly why the email
   * candidates below still exist.
   */
  userId: string | null;
  paidAt: Date;
  /**
   * Email addresses to try against the user table, in descending order of
   * intent: anything typed into a form field first, the billing address last.
   */
  candidateEmails: string[];
};

const EMAIL = /[^\s,;<>()[\]]+@[^\s,;<>()[\]]+\.[a-z]{2,}/i;

function firstEmailIn(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.match(EMAIL)?.[0]?.toLowerCase() ?? null;
}

/**
 * Pulls the payment entity out of a webhook body.
 *
 * `payment.captured` and `payment_link.paid` nest it identically, which is why
 * subscribing to both is safe: the second delivery for a single purchase
 * resolves to the same payment id and is rejected as a duplicate.
 */
export function extractPayment(body: unknown): CapturedPayment | null {
  const event = (body as { event?: unknown })?.event;
  if (typeof event !== "string" || !HANDLED.has(event)) return null;

  const entity = (
    body as { payload?: { payment?: { entity?: Record<string, unknown> } } }
  )?.payload?.payment?.entity;

  if (!entity || typeof entity.id !== "string") return null;
  if (typeof entity.amount !== "number") return null;

  const notes =
    entity.notes && typeof entity.notes === "object"
      ? (entity.notes as Record<string, unknown>)
      : {};

  const note = typeof notes.comment === "string" ? notes.comment : null;
  const email = typeof entity.email === "string" ? entity.email : null;

  // Every note value is scanned, not just `comment`: the page's custom fields
  // can be renamed in the dashboard without anyone remembering to change this.
  const candidates = Object.values(notes)
    .map(firstEmailIn)
    .concat(email?.toLowerCase() ?? null)
    .filter((e): e is string => Boolean(e));

  return {
    id: entity.id,
    amount: entity.amount,
    currency: typeof entity.currency === "string" ? entity.currency : "INR",
    email,
    contact: typeof entity.contact === "string" ? entity.contact : null,
    note,
    orderId: typeof entity.order_id === "string" ? entity.order_id : null,
    userId: typeof notes.userId === "string" && notes.userId ? notes.userId : null,
    paidAt:
      typeof entity.created_at === "number"
        ? new Date(entity.created_at * 1000)
        : new Date(),
    candidateEmails: [...new Set(candidates)],
  };
}

// ---------------------------------------------------------------------------
// Checkout — the in-app payment sheet
// ---------------------------------------------------------------------------

const API = "https://api.razorpay.com/v1";

export const keyId = process.env.RAZORPAY_KEY_ID ?? "";
const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";

/** Whether this deployment can open a payment sheet at all. */
export const checkoutEnabled = Boolean(keyId && keySecret);
/** Test keys move no money; the UI says so rather than implying a real charge. */
export const liveMode = keyId.startsWith("rzp_live_");

function authHeader(): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!checkoutEnabled) {
    throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set");
  }

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: authHeader(),
      "content-type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    // Razorpay puts the useful part in error.description; the HTTP status on
    // its own says nothing about which field was wrong.
    const detail =
      (body as { error?: { description?: string } })?.error?.description ??
      `HTTP ${res.status}`;
    throw new Error(`Razorpay: ${detail}`);
  }

  return body as T;
}

export type Order = {
  id: string;
  amount: number;
  currency: string;
};

/**
 * Creates the order the payment sheet will charge against.
 *
 * The amount is fixed here, server-side, which is the whole reason Checkout is
 * safer than the payment page: the buyer cannot type their own figure, and
 * `notes` carries the account to credit so nothing has to be matched by email
 * afterwards.
 */
export function createOrder(args: {
  amount: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<Order> {
  return call<Order>("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: args.amount,
      currency: "INR",
      receipt: args.receipt,
      notes: args.notes,
    }),
  });
}

export type FetchedPayment = {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  /** "captured" is money taken; "authorized" is only held. */
  status: string;
  email: string | null;
  contact: string | null;
  method: string | null;
  notes: Record<string, string> | null;
  created_at: number;
};

/**
 * Reads a payment back from Razorpay.
 *
 * The browser callback reports only ids, so the amount and the captured/
 * authorised distinction have to come from the API rather than being taken on
 * the client's word.
 */
export function fetchPayment(paymentId: string): Promise<FetchedPayment> {
  return call<FetchedPayment>(`/payments/${paymentId}`);
}

/**
 * Verifies the signature the payment sheet hands back.
 *
 * Note this is keyed with the *API key secret*, not the webhook secret, and
 * signs `order_id|payment_id` rather than a request body — a different scheme
 * from verifySignature() above, easily confused for it.
 */
export function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string = keySecret,
): boolean {
  if (!secret || !signature) return false;

  const expected = createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest();

  let received: Buffer;
  try {
    received = Buffer.from(signature, "hex");
  } catch {
    return false;
  }

  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}
