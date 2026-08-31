import { headers } from "next/headers";

import { db } from "@/lib/db";

/**
 * Fixed-window rate limiting, backed by the Postgres already in front of us.
 *
 * The window start is part of the primary key, so a new window is an insert
 * rather than a read-modify-write — two requests racing at a boundary both
 * land, and neither reads a stale count. Postgres does the increment.
 *
 * Keyed by user id wherever there is a session. IP alone is close to useless
 * for a mobile-first app: carrier NAT puts thousands of unrelated people
 * behind one address, so an IP limit tight enough to stop abuse also locks
 * out an entire city. IP limits here are only for the unauthenticated edges.
 */

export type Limit = {
  /** Requests permitted inside one window. */
  max: number;
  /** Window length in seconds. */
  windowSec: number;
};

/**
 * Every limited surface in the app, in one place so the budget is legible.
 * Numbers are per identifier, not global.
 */
export const LIMITS = {
  /** One shared reviewer password with no lockout is the softest target here. */
  signIn: { max: 5, windowSec: 15 * 60 },

  /** Each of these buys a Whisper call and a gpt-4o vision call. */
  aiCreate: { max: 20, windowSec: 60 * 60 },
  aiCreateDaily: { max: 60, windowSec: 24 * 60 * 60 },
  /** Re-runs the whole pipeline with no upload to slow it down. */
  aiReprocess: { max: 5, windowSec: 60 * 60 },

  /** Reads five tables and serialises them. */
  export: { max: 3, windowSec: 60 * 60 },

  /** A ceiling above the client's own backoff, not a substitute for it. */
  processing: { max: 30, windowSec: 60 },

  /** An account-existence oracle if left unbounded. */
  linkAthlete: { max: 10, windowSec: 24 * 60 * 60 },
  /** Writes into somebody else's timeline. */
  comment: { max: 30, windowSec: 60 * 60 },

  /** Each call creates a real Razorpay order. */
  checkout: { max: 10, windowSec: 60 * 60 },
  checkoutVerify: { max: 20, windowSec: 60 * 60 },

  /** Fires on keystrokes in the exercise picker. */
  exercises: { max: 60, windowSec: 60 },

  /** Storage is billed by the gigabyte and nothing else caps lifetime use. */
  uploadBytes: { max: 50 * 1024 * 1024, windowSec: 24 * 60 * 60 },

  /** Catches whatever the specific limits above missed. */
  global: { max: 300, windowSec: 60 },
} as const satisfies Record<string, Limit>;

export type Bucket = keyof typeof LIMITS;

export type RateResult = {
  ok: boolean;
  /** How many more requests this window allows. */
  remaining: number;
  /** Seconds until the window resets — the value for Retry-After. */
  retryAfter: number;
};

/**
 * Consumes `cost` units from a bucket.
 *
 * `cost` exists for the byte-denominated limits: an upload spends its own size
 * rather than one request's worth.
 */
export async function consume(
  bucket: Bucket,
  identifier: string,
  cost = 1,
): Promise<RateResult> {
  const limit = LIMITS[bucket];
  const windowMs = limit.windowSec * 1000;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;
  const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));

  const key = `${bucket}:${identifier}:${windowStart}`;

  try {
    const row = await db.rateLimit.upsert({
      where: { key },
      create: { key, count: cost, expiresAt: new Date(resetAt) },
      update: { count: { increment: cost } },
      select: { count: true },
    });

    return {
      ok: row.count <= limit.max,
      remaining: Math.max(0, limit.max - row.count),
      retryAfter,
    };
  } catch {
    // A limiter that fails closed takes the whole app down with it when the
    // database hiccups. Availability wins here: the specific authorisation
    // checks are what actually protect data, and those still fail closed.
    return { ok: true, remaining: limit.max, retryAfter };
  }
}

/** Reports whether a bucket has room, without spending from it. */
export async function peek(
  bucket: Bucket,
  identifier: string,
): Promise<RateResult> {
  const limit = LIMITS[bucket];
  const windowMs = limit.windowSec * 1000;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const retryAfter = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));

  try {
    const row = await db.rateLimit.findUnique({
      where: { key: `${bucket}:${identifier}:${windowStart}` },
      select: { count: true },
    });
    const count = row?.count ?? 0;
    return {
      ok: count < limit.max,
      remaining: Math.max(0, limit.max - count),
      retryAfter,
    };
  } catch {
    return { ok: true, remaining: limit.max, retryAfter };
  }
}

/** Thrown by `enforce`; carries the wait so callers can surface it. */
export class RateLimited extends Error {
  constructor(readonly retryAfter: number, message: string) {
    super(message);
    this.name = "RateLimited";
  }
}

function waitPhrase(seconds: number): string {
  if (seconds < 90) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 90) return `${minutes} minutes`;
  return `${Math.ceil(minutes / 60)} hours`;
}

/**
 * Consumes from a bucket and throws when it is spent.
 *
 * Server actions catch this and return the message; route handlers let
 * `rateLimitResponse` turn it into a 429.
 */
export async function enforce(
  bucket: Bucket,
  identifier: string,
  message: string,
  cost = 1,
): Promise<void> {
  const result = await consume(bucket, identifier, cost);
  if (!result.ok) {
    throw new RateLimited(
      result.retryAfter,
      `${message} Try again in ${waitPhrase(result.retryAfter)}.`,
    );
  }
}

/** The 429 for a caught `RateLimited`, with the header a client can act on. */
export function rateLimitResponse(err: RateLimited): Response {
  return Response.json(
    { error: err.message },
    { status: 429, headers: { "Retry-After": String(err.retryAfter) } },
  );
}

/**
 * Best-effort client address. Trusts the platform's forwarding header, which
 * is only safe because Vercel overwrites it at the edge — behind any other
 * proxy this needs to read that proxy's own trusted header instead.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

/** Removes windows that have closed. Called by the job worker's sweep. */
export async function purgeExpired(): Promise<number> {
  const { count } = await db.rateLimit.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
