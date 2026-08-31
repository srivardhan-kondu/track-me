import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { db } from "@/lib/db";
import { trialEndsFrom } from "@/lib/entitlements";

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
      allowDangerousEmailAccountLinking: true,
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
