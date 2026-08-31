import { timingSafeEqual } from "node:crypto";

import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { db } from "@/lib/db";
import { trialEndsFrom } from "@/lib/entitlements";
import { clientIp, consume } from "@/lib/rate-limit";

export const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

/**
 * A password-less sign-in for local development. Hard-gated on NODE_ENV so it
 * can never be reachable in a production deployment; it stays available
 * alongside Google in development so the seeded demo accounts keep working
 * while real OAuth is being tested.
 */
export const devLoginEnabled = process.env.NODE_ENV !== "production";

/**
 * A single password account, for people who must inspect the app but cannot
 * be given a Google login — a payment gateway's activation reviewers, chiefly.
 *
 * Both variables have to be set for the provider to exist at all, so clearing
 * either one and redeploying removes the door entirely. It is worth removing
 * once a review is over: it is one shared password, and it never expires on
 * its own.
 */
export const reviewLoginEnabled = Boolean(
  process.env.REVIEW_EMAIL && process.env.REVIEW_PASSWORD,
);

/**
 * Throttles credential sign-in.
 *
 * Constant-time comparison is worth nothing against an attacker who gets
 * unlimited guesses, and the reviewer account is a single shared password on a
 * known address. Counted against the client address and the attempted email
 * separately, so neither a single host working through passwords nor a
 * distributed run at one account gets a free pass.
 *
 * Returns false when the caller should be refused without checking anything.
 */
async function signInAllowed(email: string): Promise<boolean> {
  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([
    consume("signIn", `ip:${ip}`),
    consume("signIn", `email:${email}`),
  ]);

  if (!byIp.ok || !byEmail.ok) {
    console.warn(`[auth] throttled a sign-in attempt for ${email} from ${ip}`);
    return false;
  }
  return true;
}

/** Constant-time, so a wrong password cannot be found one character at a time. */
function passwordMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ATHLETE" | "COACH";
      timeZone: string | null;
    } & DefaultSession["user"];
  }
}

const providers = [];

if (googleEnabled) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      // Deliberately off. Linking by email alone means any provider that
      // merely asserts an address gets whatever account already holds it —
      // which, next to two providers that upsert users by email, is an
      // account-takeover path rather than a convenience.
      allowDangerousEmailAccountLinking: false,
    }),
  );
}

if (reviewLoginEnabled) {
  providers.push(
    Credentials({
      id: "review",
      name: "Reviewer sign-in",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        const expectedEmail = process.env.REVIEW_EMAIL!.trim().toLowerCase();

        if (!(await signInAllowed(email || "unknown"))) return null;
        if (email !== expectedEmail) return null;
        if (!passwordMatches(password, process.env.REVIEW_PASSWORD!)) return null;

        const existing = await db.user.findUnique({
          where: { email },
          select: { id: true, _count: { select: { accounts: true } } },
        });

        // If REVIEW_EMAIL is ever set to an address somebody signs in with for
        // real, this password would open their account. A reviewer gets a
        // fresh row or nothing.
        if (existing && existing._count.accounts > 0) {
          console.error(
            "[auth] REVIEW_EMAIL belongs to a real account; refusing to sign in",
          );
          return null;
        }

        // Always an athlete: a reviewer has no business reading other
        // people's timelines, which is what the coach role grants.
        const user = await db.user.upsert({
          where: { email },
          update: {},
          create: { email, name: "Reviewer", role: "ATHLETE" },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  );
}

if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Development sign-in",
      credentials: {
        email: { label: "Email", type: "email" },
        role: { label: "Role", type: "text" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        if (!email || !email.includes("@")) return null;
        if (!(await signInAllowed(email))) return null;

        const role = creds?.role === "COACH" ? "COACH" : "ATHLETE";
        const name = email
          .split("@")[0]
          .split(/[._-]+/)
          .filter(Boolean)
          .map((p) => p[0].toUpperCase() + p.slice(1))
          .join(" ");

        const user = await db.user.upsert({
          where: { email },
          update: {},
          create: { email, name, role },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  // JWT sessions so the credentials provider works alongside the adapter.
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/signin" },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;

      if (token.sub) {
        const dbUser = await db.user.findUnique({
          where: { id: token.sub },
          select: {
            role: true,
            name: true,
            image: true,
            timeZone: true,
            trialEndsAt: true,
          },
        });
        if (dbUser) {
          // Stamped here rather than in an adapter event because the dev
          // credentials provider creates its users itself and never fires one.
          // Doing it on sign-in also starts the clock for accounts that
          // predate the paywall, which is the intended launch behaviour.
          if (!dbUser.trialEndsAt) {
            await db.user.update({
              where: { id: token.sub },
              data: { trialEndsAt: trialEndsFrom(new Date()) },
            });
          }

          token.role = dbUser.role;
          token.name = dbUser.name;
          token.picture = dbUser.image;
          token.timeZone = dbUser.timeZone;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role =
          (token.role as "ATHLETE" | "COACH" | undefined) ?? "ATHLETE";
        session.user.timeZone = (token.timeZone as string | null) ?? null;
      }
      return session;
    },
  },
});
