import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type SessionUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: "ATHLETE" | "COACH";
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
 */
export async function assertCanViewAthlete(
  viewerId: string,
  athleteId: string,
): Promise<void> {
  if (viewerId === athleteId) return;

  const link = await db.coachAthlete.findUnique({
    where: { coachId_athleteId: { coachId: viewerId, athleteId } },
    select: { id: true },
  });

  if (!link) throw new Error("Not authorised to view this athlete");
}
