import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity } from "lucide-react";

import { SignInForm } from "@/components/auth/signin-form";
import { devLoginEnabled, googleEnabled } from "@/lib/auth";
import { currentUser } from "@/lib/session";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; error?: string }>;
}) {
  const user = await currentUser();
  if (user) redirect(user.role === "COACH" ? "/trainer" : "/dashboard");

  const { role, error } = await searchParams;

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="h-4 w-4" />
          </div>
          <span className="text-xl font-semibold tracking-tight">GymOS</span>
        </Link>

        <SignInForm
          googleEnabled={googleEnabled}
          devLoginEnabled={devLoginEnabled}
          defaultRole={role === "COACH" ? "COACH" : "ATHLETE"}
          error={error}
        />
      </div>
    </main>
  );
}
