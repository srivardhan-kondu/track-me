"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ChoiceTile } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.55Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.11 0 5.72-1.03 7.62-2.8l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.02-6.45-4.74H1.7v2.98A11.5 11.5 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.67a6.9 6.9 0 0 1 0-4.4V7.29H1.7a11.5 11.5 0 0 0 0 10.36l3.85-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.2 15.1 0 12 0A11.5 11.5 0 0 0 1.7 7.29l3.85 2.98C6.46 7.55 9 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function SignInForm({
  googleEnabled,
  devLoginEnabled,
  defaultRole,
  error,
}: {
  googleEnabled: boolean;
  devLoginEnabled: boolean;
  defaultRole: "ATHLETE" | "COACH";
  error?: string;
}) {
  const [pending, setPending] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"ATHLETE" | "COACH">(defaultRole);

  React.useEffect(() => {
    if (error) toast.error("Could not sign you in. Please try again.");
  }, [error]);

  async function handleGoogle() {
    setPending("google");
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  async function handleDev(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }
    setPending("dev");
    const res = await signIn("dev", { email, role, redirect: false });
    if (res?.error) {
      setPending(null);
      toast.error("Sign-in failed.");
      return;
    }
    window.location.href = role === "COACH" ? "/trainer" : "/dashboard";
  }

  return (
    <div className="rounded-[18px] border border-line-strong bg-surface p-6">
      <h1 className="font-serif text-[26px] leading-none text-fg">
        Welcome to Track Me
      </h1>
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-fg-dim">
        Log training in seconds. Your coach sees it automatically.
      </p>

      <div className="mt-6 flex flex-col gap-5">
        {googleEnabled && (
          <Button
            onClick={handleGoogle}
            disabled={pending !== null}
            variant="outline"
            className="w-full"
            size="lg"
          >
            {pending === "google" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleMark />
            )}
            Continue with Google
          </Button>
        )}

        {googleEnabled && devLoginEnabled && (
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="mono-label">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        )}

        {devLoginEnabled && (
          <form onSubmit={handleDev} className="flex flex-col gap-4">
            <p className="rounded-xl border border-dashed border-line-strong p-3.5 text-[11.5px] leading-relaxed text-fg-dim">
              Google OAuth is not configured, so Track Me is using its local
              development sign-in. Set{" "}
              <code className="font-mono text-fg-muted">AUTH_GOOGLE_ID</code>{" "}
              and{" "}
              <code className="font-mono text-fg-muted">
                AUTH_GOOGLE_SECRET
              </code>{" "}
              to switch it off.
            </p>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="athlete@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Sign in as</Label>
              <div className="grid grid-cols-2 gap-2.5">
                <ChoiceTile
                  title="Athlete"
                  blurb="Log meals, workouts and weight."
                  selected={role === "ATHLETE"}
                  onClick={() => setRole("ATHLETE")}
                />
                <ChoiceTile
                  title="Coach"
                  blurb="Monitor athletes, leave feedback."
                  selected={role === "COACH"}
                  onClick={() => setRole("COACH")}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={pending !== null}
            >
              {pending === "dev" && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue
            </Button>
          </form>
        )}

        {!googleEnabled && !devLoginEnabled && (
          <p className="text-[12.5px] leading-relaxed text-fg-dim">
            No sign-in provider is configured. Set{" "}
            <code className="font-mono text-fg-muted">AUTH_GOOGLE_ID</code> and{" "}
            <code className="font-mono text-fg-muted">AUTH_GOOGLE_SECRET</code>{" "}
            to enable Google login.
          </p>
        )}
      </div>
    </div>
  );
}
