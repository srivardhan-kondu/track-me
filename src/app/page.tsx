import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Camera, LineChart, Mic, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { currentUser } from "@/lib/session";

const FEATURES = [
  {
    icon: Mic,
    title: "Speak, don't type",
    body: "Record a voice note after a meal or a session. Whisper transcribes it and GPT turns it into structured macros and sets.",
  },
  {
    icon: Camera,
    title: "One photo is enough",
    body: "Snap the plate. Vision estimates calories, protein, carbs and fat per ingredient — no weighing, no lookup tables.",
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
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Track Me</span>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/signin">Sign in</Link>
        </Button>
      </header>

      <section className="flex flex-1 flex-col justify-center py-16">
        <p className="text-sm font-medium text-primary">
          Replace WhatsApp-based reporting
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Fitness reporting that takes
          <span className="text-primary"> ten seconds</span>, not ten messages.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
          Athletes log meals, lifts and weigh-ins by voice and photo. AI does
          the transcription and the maths. Coaches get one dashboard instead of
          scrolling through a chat thread.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/signin">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/signin?role=COACH">I&apos;m a coach</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-5 pb-16 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <Icon className="h-5 w-5 text-primary" />
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {body}
            </p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
        The goal is not calorie counting. The goal is accountability.
      </footer>
    </main>
  );
}
