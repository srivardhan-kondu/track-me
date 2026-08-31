import Link from "next/link";

import { Logo } from "@/components/layout/shell";
import { SiteFooter } from "@/components/layout/site-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FREE_HISTORY_DAYS, PRICES, TRIAL_DAYS } from "@/lib/entitlements";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Pricing",
  description:
    "Track Me is free to log with. Premium adds unlimited history, progress photos and AI analysis, from ₹99 a month.",
};

const rupees = (paise: number) => `₹${paise / 100}`;

const FREE_FEATURES = [
  "Workout logging, by voice or by hand",
  "Workout routines",
  "Weight tracking",
  "Basic progress tracking",
  `The last ${FREE_HISTORY_DAYS} days of history`,
];

const PREMIUM_FEATURES = [
  "Unlimited history",
  "Progress photos",
  "AI physique analysis",
  "AI workout and nutrition analysis",
  "Recovery tracking",
  "Strength progression charts",
  "Personal record tracking",
  "Data export",
];

const PLANS = [
  {
    name: "Monthly",
    price: rupees(PRICES.MONTHLY),
    cadence: "per month",
    note: "Renews monthly. Stop whenever you like.",
    featured: false,
  },
  {
    name: "Yearly",
    price: rupees(PRICES.YEARLY),
    cadence: "per year",
    note: `Works out at about ₹${Math.round(PRICES.YEARLY / 12 / 100)} a month — two months free.`,
    featured: true,
  },
  {
    name: "Founder's",
    price: rupees(PRICES.LIFETIME),
    cadence: "once",
    note: "Paid once, yours permanently. Limited to the first 100 members.",
    featured: false,
  },
];

function Tick() {
  return (
    <svg viewBox="0 0 12 12" className="mt-[5px] h-3 w-3 shrink-0" aria-hidden>
      <path
        d="M2 6.2 4.6 8.8 10 3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <main className="mx-auto w-full max-w-[960px] px-6 py-12 sm:py-16">
      <div className="mb-10">
        <Logo href="/" />
      </div>

      <header className="max-w-[560px]">
        <h1 className="font-serif text-[32px] leading-[1.1] text-fg sm:text-[38px]">
          Logging is free. Everything you look back on is Premium.
        </h1>
        <p className="mt-4 text-[13.5px] leading-relaxed text-fg-dim">
          Every plan starts with {TRIAL_DAYS} days of Premium, free, with no
          card required. Nothing you record is ever deleted — the free plan
          simply shows you the last {FREE_HISTORY_DAYS} days of it.
        </p>
      </header>

      <section className="mt-10 grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              "flex flex-col rounded-2xl border p-6",
              plan.featured
                ? "border-accent-line bg-accent-soft"
                : "border-line-strong bg-surface",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold text-fg">{plan.name}</h2>
              {plan.featured && <Badge>Best value</Badge>}
            </div>

            <p className="mt-4 font-serif text-[34px] leading-none text-fg">
              {plan.price}
            </p>
            <p className="mono-label mt-2">{plan.cadence}</p>

            <p className="mt-4 flex-1 text-[12px] leading-relaxed text-fg-dim">
              {plan.note}
            </p>

            <Button asChild className="mt-6 w-full" size="lg">
              <Link href="/signin">Start free trial</Link>
            </Button>
          </div>
        ))}
      </section>

      <p className="mt-5 text-[12px] leading-relaxed text-fg-dim">
        All prices are in Indian Rupees and include GST where applicable. There
        are no setup fees and no charges beyond the plan price shown.
      </p>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface-muted p-6">
          <h2 className="text-[13px] font-semibold text-fg">
            Free, with no time limit
          </h2>
          <ul className="mt-4 flex flex-col gap-2.5 text-[12.5px] leading-relaxed text-fg-muted">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex gap-2.5">
                <span className="text-fg-faint">
                  <Tick />
                </span>
                <span className="flex-1">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-line-strong bg-surface p-6">
          <h2 className="text-[13px] font-semibold text-fg">
            Everything in Free, plus
          </h2>
          <ul className="mt-4 flex flex-col gap-2.5 text-[12.5px] leading-relaxed text-fg-muted">
            {PREMIUM_FEATURES.map((f) => (
              <li key={f} className="flex gap-2.5">
                <span className="text-accent-text">
                  <Tick />
                </span>
                <span className="flex-1">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-line bg-surface-muted p-6">
        <h2 className="text-[13px] font-semibold text-fg">
          Before you pay, the honest version
        </h2>
        <div className="mt-3 flex flex-col gap-3 text-[12.5px] leading-relaxed text-fg-dim">
          <p>
            Subscriptions do not renew automatically. When a plan runs out you
            are moved back to the free plan and asked whether you want to
            continue — you will not be charged without choosing to be.
          </p>
          <p>
            AI estimates are estimates. Calorie and macro figures are useful for
            spotting trends, not for clinical accuracy, and nothing in Track Me
            is medical advice. See our{" "}
            <Link
              href="/terms"
              className="text-accent-text underline-offset-4 hover:underline"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/refunds"
              className="text-accent-text underline-offset-4 hover:underline"
            >
              Refunds & Cancellation policy
            </Link>
            .
          </p>
        </div>
      </section>

      <SiteFooter className="mt-14" />
    </main>
  );
}
