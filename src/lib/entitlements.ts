import { addDays, addMonths, addYears } from "date-fns";

/**
 * Plan arithmetic, kept free of database and network imports so the money
 * rules can be tested on their own.
 */

/** Mirrors the Prisma enums; a local union keeps this module dependency-free. */
export type PlanTerm = "MONTHLY" | "YEARLY" | "LIFETIME";
export type Plan = "FREE" | "PREMIUM";

/** Every new account gets this long before the paywall applies. */
export const TRIAL_DAYS = 7;

/**
 * How far back a free account can look. Logging is never restricted — what is
 * paid for is the history, so nothing an athlete records is ever taken away,
 * only hidden until they subscribe.
 */
export const FREE_HISTORY_DAYS = 7;

/** Narrows a requested window to what the account is entitled to. */
export function historyDays(premium: boolean, requested: number): number {
  return premium ? requested : Math.min(requested, FREE_HISTORY_DAYS);
}

/**
 * List price of each term in *paise*, which is the unit Razorpay reports and
 * therefore the only unit this file speaks. The payment page lets the buyer
 * type any figure, so these amounts are the sole means of telling which plan
 * somebody just bought — nothing else in the payload identifies it.
 */
export const PRICES: Record<PlanTerm, number> = {
  MONTHLY: 99_00,
  YEARLY: 799_00,
  LIFETIME: 999_00,
};

/**
 * The term a payment buys, or null if the amount is not one of our prices.
 *
 * Deliberately an exact match. An underpayment must not round down to the
 * cheapest plan, and an overpayment is more likely a typo than a tip — both
 * are better parked for a human than silently converted into access.
 */
export function termForAmount(paise: number): PlanTerm | null {
  const found = (Object.keys(PRICES) as PlanTerm[]).find(
    (term) => PRICES[term] === paise,
  );
  return found ?? null;
}

/**
 * When a term bought now should run out, given whatever the user already has.
 *
 * Renewing early extends the existing expiry rather than restarting from
 * today, so a user who pays on the 28th of a month they have paid through
 * does not forfeit the remaining days.
 */
export function expiryFor(
  term: PlanTerm,
  now: Date,
  currentExpiry?: Date | null,
): Date | null {
  if (term === "LIFETIME") return null;

  const from =
    currentExpiry && currentExpiry > now ? new Date(currentExpiry) : now;

  return term === "MONTHLY" ? addMonths(from, 1) : addYears(from, 1);
}

export function trialEndsFrom(start: Date): Date {
  return addDays(start, TRIAL_DAYS);
}

export type Entitlement = {
  plan: Plan;
  planExpiresAt: Date | null;
  trialEndsAt: Date | null;
};

/** True while the user has paid access, or is inside their free trial. */
export function isPremium(user: Entitlement, now: Date = new Date()): boolean {
  if (user.plan === "PREMIUM") {
    // A null expiry on a paid plan means LIFETIME.
    if (!user.planExpiresAt || user.planExpiresAt > now) return true;
  }
  return Boolean(user.trialEndsAt && user.trialEndsAt > now);
}

/** True when premium is available only because the trial has not run out. */
export function isTrialing(user: Entitlement, now: Date = new Date()): boolean {
  return isPremium(user, now) && !isPaid(user, now);
}

/**
 * Whole days left in the trial, or null when the account is not trialing.
 *
 * Rounded up, so the last part-day still reads "1 day left" rather than "0" —
 * the countdown should never tell somebody their trial is already over while
 * they can still use it.
 */
export function trialDaysLeft(
  user: Entitlement,
  now: Date = new Date(),
): number | null {
  if (!isTrialing(user, now)) return null;

  const ms = user.trialEndsAt!.getTime() - now.getTime();
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

/**
 * True for somebody whose free trial has run out and who never paid.
 *
 * Distinguishes the two kinds of free account: one that has seen what Premium
 * does and one that never has. They are worth different conversations, so the
 * paywall copy asks which it is.
 */
export function trialLapsed(user: Entitlement, now: Date = new Date()): boolean {
  if (isPremium(user, now)) return false;
  return Boolean(user.trialEndsAt && user.trialEndsAt <= now);
}

/** True when premium is backed by a payment, trial aside. */
export function isPaid(user: Entitlement, now: Date = new Date()): boolean {
  if (user.plan !== "PREMIUM") return false;
  return !user.planExpiresAt || user.planExpiresAt > now;
}

export type PlanUpdate = {
  plan: Plan;
  planTerm: PlanTerm;
  planExpiresAt: Date | null;
};

/**
 * The columns a purchase should write, or null when it should write nothing.
 *
 * Pure so that both the webhook and the reconciliation script apply a payment
 * by exactly the same rules — including the one case where a real payment
 * changes nothing: a lifetime plan already covers whatever was just bought,
 * and writing an expiry over it would quietly demote the user.
 */
export function planUpdateFor(
  current: Pick<Entitlement, "plan"> & { planTerm: PlanTerm | null; planExpiresAt: Date | null },
  term: PlanTerm,
  at: Date,
): PlanUpdate | null {
  if (current.plan === "PREMIUM" && current.planTerm === "LIFETIME") return null;

  return {
    plan: "PREMIUM",
    planTerm: term,
    planExpiresAt: expiryFor(term, at, current.planExpiresAt),
  };
}
