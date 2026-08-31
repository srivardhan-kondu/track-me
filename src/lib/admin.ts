import {
  PRICES,
  isPaid,
  isPremium,
  isTrialing,
  type Entitlement,
  type PlanTerm,
} from "@/lib/entitlements";

/**
 * The rules the admin console runs on, kept free of database and network
 * imports so the ones that matter — who is an admin, what a plan is worth —
 * can be tested without standing anything up.
 *
 * Admin is not a value of `Role`. Athletes switch their own role in Settings,
 * so an ADMIN member of that enum would put this console one dropdown away
 * from every account in the system. It is a separate column, plus an
 * environment allowlist that needs no database at all — which is what makes it
 * possible to get back in after a restore, or when the only admin account was
 * deleted by mistake.
 */

/** Addresses that are admin regardless of what the database says. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

/** True when this address is on the environment allowlist. */
export function emailIsAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

/**
 * Whether an account may open the console.
 *
 * Either source is sufficient. The allowlist is the bootstrap and the way
 * back in; the column is how one admin grants another without a redeploy.
 */
export function grantsAdmin(user: {
  email: string | null;
  isAdmin: boolean;
}): boolean {
  return user.isAdmin || emailIsAdmin(user.email);
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** Paise as rupees, in the Indian digit grouping Razorpay reports in. */
export function inr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

/** A larger figure shortened for a stat tile: ₹1.2L, ₹84.5k, ₹900. */
export function inrShort(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10_000_00) return `₹${(rupees / 100_000).toFixed(1)}Cr`;
  if (rupees >= 1_00_000) return `₹${(rupees / 100_000).toFixed(1)}L`;
  if (rupees >= 10_000) return `₹${(rupees / 1000).toFixed(1)}k`;
  return `₹${Math.round(rupees).toLocaleString("en-IN")}`;
}

/**
 * What one active subscription contributes to a month of revenue, in paise.
 *
 * A yearly plan is spread across the twelve months it covers rather than
 * counted in the month it was bought, so the figure does not leap on the day
 * somebody renews. Lifetime contributes nothing: it is bought once and is not
 * recurring revenue by any definition, and pretending otherwise would put a
 * number on this dashboard that never comes in again.
 */
export function monthlyValuePaise(term: PlanTerm | null): number {
  if (term === "MONTHLY") return PRICES.MONTHLY;
  if (term === "YEARLY") return Math.round(PRICES.YEARLY / 12);
  return 0;
}

// ---------------------------------------------------------------------------
// Account state
// ---------------------------------------------------------------------------

export type AccountState = "PAID" | "TRIAL" | "LAPSED" | "FREE";

/**
 * The four states an account can actually be in, which is one more than the
 * `plan` column knows about: it cannot tell a trial from a paid plan, nor a
 * free account that has never seen Premium from one whose trial ran out.
 */
export function accountState(
  user: Entitlement,
  now: Date = new Date(),
): AccountState {
  if (isPaid(user, now)) return "PAID";
  if (isTrialing(user, now)) return "TRIAL";
  if (user.trialEndsAt && !isPremium(user, now)) return "LAPSED";
  return "FREE";
}

export const STATE_LABEL: Record<AccountState, string> = {
  PAID: "Paying",
  TRIAL: "In trial",
  LAPSED: "Trial over",
  FREE: "Free",
};

/** Badge variant per state, so the same colour means the same thing. */
export const STATE_TONE: Record<
  AccountState,
  "default" | "secondary" | "success" | "warning"
> = {
  PAID: "success",
  TRIAL: "default",
  LAPSED: "warning",
  FREE: "secondary",
};

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export type QueueTally = {
  queued: number;
  running: number;
  failed: number;
  /** Age of the oldest job still waiting, in seconds. */
  oldestQueuedSec: number;
};

export type Health = { tone: "ok" | "warn" | "bad"; label: string };

/**
 * A traffic light for the queue.
 *
 * Backlog alone is not a fault — a burst drains. What matters is a job that
 * has been waiting longer than the worker's schedule can explain, and anything
 * that has exhausted its retries, because nothing will pick that up again.
 */
export function queueHealth(tally: QueueTally): Health {
  if (tally.failed > 0) {
    return {
      tone: "bad",
      label: `${tally.failed} gave up`,
    };
  }
  if (tally.oldestQueuedSec > 3600) {
    return { tone: "bad", label: "Backlog stalled" };
  }
  if (tally.oldestQueuedSec > 600 || tally.queued > 25) {
    return { tone: "warn", label: "Falling behind" };
  }
  if (tally.queued + tally.running > 0) return { tone: "ok", label: "Draining" };
  return { tone: "ok", label: "Idle" };
}

/** Same three tones, for the budget. */
export function budgetHealth(spent: number, budget: number): Health {
  const ratio = budget > 0 ? spent / budget : 0;
  if (ratio >= 1) return { tone: "bad", label: "Spent out" };
  if (ratio >= 0.8) return { tone: "warn", label: "Nearly spent" };
  return { tone: "ok", label: "Within budget" };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** "4m ago", "3d ago" — coarse on purpose; precision here is noise. */
export function ago(date: Date | null | undefined): string {
  if (!date) return "—";
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86_400);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.floor(days / 365)}y ago`;
}

/** Absolute, short, and unambiguous — for tables, where "3d ago" is not enough. */
export function stamp(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export function shortDate(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "—";
}

/** Trims a long identifier to something that still fits a column. */
export function shortId(id: string, keep = 8): string {
  return id.length <= keep + 2 ? id : `${id.slice(0, keep)}…`;
}

// ---------------------------------------------------------------------------
// Paging
// ---------------------------------------------------------------------------

export type Page = {
  page: number;
  perPage: number;
  pages: number;
  total: number;
  /** 1-based positions of the first and last row on this page. */
  from: number;
  to: number;
  skip: number;
  hasPrev: boolean;
  hasNext: boolean;
};

/**
 * Clamps a page number to something that exists.
 *
 * A page past the end is a URL somebody typed, or a filter that just narrowed
 * under them — either way it should show the last page rather than nothing.
 */
export function paginate(total: number, page: number, perPage: number): Page {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const skip = (current - 1) * perPage;

  return {
    page: current,
    perPage,
    pages,
    total,
    from: total === 0 ? 0 : skip + 1,
    to: Math.min(total, skip + perPage),
    skip,
    hasPrev: current > 1,
    hasNext: current < pages,
  };
}

/** Reads a page number out of a search param without trusting it. */
export function pageParam(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/**
 * The date a spend ledger key covers.
 *
 * Spend rides on the rate-limit table under `ai-spend:<YYYY-MM-DD>` — see
 * services/ai/budget.ts — so reading the history back means parsing keys.
 */
export function spendDay(key: string): string | null {
  const match = /^ai-spend:(\d{4}-\d{2}-\d{2})$/.exec(key);
  return match ? match[1] : null;
}
