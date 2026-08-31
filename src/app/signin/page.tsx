import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/signin-form";
import { Logo } from "@/components/layout/shell";
import { SiteFooter } from "@/components/layout/site-footer";
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
    <main className="gutter-x grid min-h-dvh place-items-center pb-12 pt-[calc(3rem+env(safe-area-inset-top,0px))] [--gutter:1.5rem]">
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

        <SiteFooter className="mt-10" />
      </div>
    </main>
  );
}
