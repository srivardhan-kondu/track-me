import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/signin-form";
import { Logo } from "@/components/layout/shell";
import { devLoginEnabled, googleEnabled, reviewLoginEnabled } from "@/lib/auth";
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
      <div className="w-full max-w-[380px]">
        <div className="mb-9 flex justify-center">
          <Logo href="/" />
        </div>

        <SignInForm
          googleEnabled={googleEnabled}
          devLoginEnabled={devLoginEnabled}
          reviewLoginEnabled={reviewLoginEnabled}
          defaultRole={role === "COACH" ? "COACH" : "ATHLETE"}
          error={error}
        />
      </div>
    </main>
  );
}
