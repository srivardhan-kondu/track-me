import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, LineChart, Mic, Users } from "lucide-react";

import { Logo } from "@/components/layout/shell";
import { InstallButton } from "@/components/pwa/install-button";
import { Button } from "@/components/ui/button";
import { currentUser } from "@/lib/session";

const FEATURES = [
  {
    icon: Mic,
    title: "Speak, don't type",
    body: "Record a voice note after a meal or a session. It gets transcribed and turned into structured macros and sets.",
  },
  {
    icon: Camera,
    title: "One photo is enough",
    body: "Snap the plate. Calories, protein, carbs and fat are estimated per ingredient — no weighing, no lookup tables.",
  },
  {
    icon: LineChart,
    title: "A timeline, not a chat",
    body: "Every meal, lift and weigh-in lands on a dated timeline. Nothing gets buried under yesterday's messages.",
  },
  {
    icon: Users,
    title: "Coaches see everything",
    body: "One dashboard across all athletes: compliance, macro averages, weight trend, and a place to leave feedback.",
  },
];

export default async function LandingPage() {
  const user = await currentUser();
  if (user) redirect(user.role === "COACH" ? "/trainer" : "/dashboard");

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1000px] flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <Logo href="/" />
        <Button asChild variant="ghost">
          <Link href="/signin">Sign in</Link>
        </Button>
      </header>

      <section className="flex flex-1 flex-col justify-center py-20">
        <p className="mono-label">Replaces WhatsApp-based reporting</p>

        <h1 className="mt-5 max-w-3xl font-serif text-[42px] leading-[1.05] text-fg sm:text-[58px]">
          Fitness reporting that takes
          <span className="text-accent-text"> ten seconds</span>, not ten
          messages.
        </h1>

        <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-fg-muted">
          Athletes log meals, lifts and weigh-ins by voice and photo. The
          transcription and the maths happen on their own. Coaches get one
          dashboard instead of scrolling through a chat thread.
        </p>

        <div className="mt-9 flex flex-wrap gap-2.5">
          <Button asChild size="lg">
            <Link href="/signin">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/signin?role=COACH">I&apos;m a coach</Link>
          </Button>
          <InstallButton variant="ghost" className="h-[42px] px-5 text-sm" />
        </div>
      </section>

      <section className="grid gap-3.5 pb-16 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-2xl border border-line bg-surface-muted p-5"
          >
            <Icon className="h-[18px] w-[18px] text-accent-text" />
            <h2 className="mt-3.5 text-[13.5px] font-semibold text-fg">
              {title}
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-dim">
              {body}
            </p>
          </div>
        ))}
      </section>

      <footer className="border-t border-line pt-6">
        <p className="font-serif text-[15px] italic text-fg-muted">
          The goal is not calorie counting. The goal is accountability.
        </p>
      </footer>
    </main>
  );
}
