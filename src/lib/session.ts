import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isPremium,
  isTrialing,
  type Entitlement,
  type PlanTerm,
} from "@/lib/entitlements";

export type SessionUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: "ATHLETE" | "COACH";
  /** Raw stored zone; pass through safeZone() before using it. */
  timeZone: string | null;
};

export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    role: session.user.role ?? "ATHLETE",
    timeZone: session.user.timeZone ?? null,
  };
}

/** Redirects to sign-in when there is no session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/signin");
  return user;
}

export async function requireCoach(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "COACH") redirect("/dashboard");
  return user;
}

/**
 * Authorises a coach (or the athlete themselves) to read an athlete's data.
 * Throws rather than redirecting so server actions fail closed.
 *
 * The ACCEPTED check is the whole protection. A coach can ask to monitor
 * anyone, and that request writes a PENDING row — but a request is not a
 * grant, and only the athlete can turn one into the other. Without this
 * condition, adding somebody by email would be enough to read their entire
 * history, which is exactly the hole this closes.
 */
export async function assertCanViewAthlete(
  viewerId: string,
  athleteId: string,
): Promise<void> {
  if (viewerId === athleteId) return;

  const link = await db.coachAthlete.findUnique({
    where: { coachId_athleteId: { coachId: viewerId, athleteId } },
    select: { status: true },
  });

  if (link?.status !== "ACCEPTED") {
    throw new Error("Not authorised to view this athlete");
  }
}

export type PremiumStatus = Entitlement & {
  /** Which tier was bought, for showing it as the current one. */
  planTerm: PlanTerm | null;
  premium: boolean;
  trialing: boolean;
};

/** The caller's billing state, for rendering upgrade prompts. */
export async function premiumStatus(userId: string): Promise<PremiumStatus> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      planTerm: true,
      planExpiresAt: true,
      trialEndsAt: true,
    },
  });

  const current = user ?? {
    plan: "FREE" as const,
    planTerm: null,
    planExpiresAt: null,
    trialEndsAt: null,
  };

  return {
    ...current,
    premium: isPremium(current),
    trialing: isTrialing(current),
  };
}

/**
 * Gates a premium feature. Throws rather than redirecting, for the same reason
 * assertCanViewAthlete does: server actions must fail closed.
 */
export async function assertPremium(userId: string): Promise<void> {
  const { premium } = await premiumStatus(userId);
  if (!premium) throw new Error("This feature needs a Premium plan");
}
