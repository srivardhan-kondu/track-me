import Link from "next/link";

import { Upgrade } from "@/components/billing/upgrade";
import { Badge } from "@/components/ui/badge";
import {
  FREE_HISTORY_DAYS,
  trialDaysLeft,
  type Plan,
  type PlanTerm,
} from "@/lib/entitlements";
import { PREMIUM_FEATURES } from "@/lib/plans";
import { checkoutEnabled, liveMode } from "@/lib/razorpay";

/**
 * The plan board.
 *
 * A price on its own asks the reader to remember what they would be buying, so
 * what Premium unlocks is laid out beside the prices rather than on a separate
 * marketing page — every line of it something already built and findable in
 * the app.
 */

type Status = {
  plan: Plan;
  planTerm: PlanTerm | null;
  planExpiresAt: Date | null;
  trialEndsAt: Date | null;
  premium: boolean;
  trialing: boolean;
};

/** One line describing what the account currently has, and until when. */
export function planSummary(status: Status): { label: string; detail: string } {
  const on = (d: Date) =>
    d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

  if (status.plan === "PREMIUM" && !status.planExpiresAt) {
    return { label: "Lifetime", detail: "Paid once. Nothing to renew." };
  }
  if (status.premium && !status.trialing) {
    return {
      label: "Premium",
      detail: `Renews on ${on(status.planExpiresAt!)}.`,
    };
  }
  if (status.trialing) {
    return {
      label: "Trial",
      detail: `Free premium until ${on(status.trialEndsAt!)}.`,
    };
  }
  return {
    label: "Free",
    detail: "Workout logging, routines and weight tracking.",
  };
}

/** The headline above the prices, in the buyer's own situation. */
function headline(status: Status): { title: string; sub: string } {
  if (status.trialing) {
    const left = trialDaysLeft(status);
    return {
      title:
        left === 1
          ? "Your trial ends today. Keep everything below."
          : `${left} days of Premium left. Keep everything below.`,
      sub: `When it runs out, history shrinks to the last ${FREE_HISTORY_DAYS} days. Nothing you logged is deleted — it is simply hidden until you subscribe.`,
    };
  }
  if (status.premium) {
    return {
      title: "You have all of this.",
      sub: "Extend or switch plans whenever you like. Paying early adds to your existing expiry rather than restarting it.",
    };
  }
  return {
    title: "Logging is free. Everything you look back on is Premium.",
    sub: `You are seeing the last ${FREE_HISTORY_DAYS} days. Premium opens the whole log, the photos and the analysis — from ₹99 a month.`,
  };
}

/** One unlocked capability, as a card rather than a bullet. */
function FeatureCard({
  icon: Icon,
  title,
  detail,
  owned,
}: {
  icon: (typeof PREMIUM_FEATURES)[number]["icon"];
  title: string;
  detail: string;
  owned: boolean;
}) {
  return (
    <div className="group rounded-[16px] border border-line bg-surface-raised p-3.5 transition-all duration-200 hover:-translate-y-[2px] hover:border-accent-line hover:bg-hover">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-accent-line/70 bg-accent-soft text-accent-text transition-colors group-hover:border-accent">
        <Icon className="h-[15px] w-[15px]" />
      </span>

      <p className="mt-3 text-[12.5px] font-semibold text-fg">{title}</p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-fg-dim">{detail}</p>

      {owned && (
        <p className="mono-label mt-2.5 text-sage-text">Included</p>
      )}
    </div>
  );
}

export function PlanSection({ status }: { status: Status }) {
  const { label, detail } = planSummary(status);
  const { title, sub } = headline(status);

  return (
    <section className="overflow-hidden rounded-2xl border border-line-strong bg-surface">
      <div className="border-b border-line p-[22px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[13px] font-semibold text-fg">Plan</h2>
          <Badge variant={status.premium ? "default" : "secondary"}>{label}</Badge>
          <span className="text-[12px] text-fg-dim">{detail}</span>
        </div>

        <p className="mt-4 max-w-[560px] font-serif text-[22px] leading-[1.25] text-fg">
          {title}
        </p>
        <p className="mt-2.5 max-w-[560px] text-[12.5px] leading-relaxed text-fg-dim">
          {sub}
        </p>
      </div>

      <div className="grid gap-3 p-[22px] sm:grid-cols-2 lg:grid-cols-3">
        {PREMIUM_FEATURES.map((feature) => (
          <FeatureCard
            key={feature.title}
            icon={feature.icon}
            title={feature.title}
            detail={feature.detail}
            owned={status.premium}
          />
        ))}
      </div>

      <div className="border-t border-line p-[22px]">
        {checkoutEnabled ? (
          <>
            <Upgrade currentTerm={status.planTerm} />

            <p className="mt-3.5 text-[11.5px] leading-relaxed text-fg-dim">
              Payment opens in Razorpay Checkout, over this page. Plans do not
              renew automatically — when one runs out you are asked before
              anything is charged again. See our{" "}
              <Link
                href="/refunds"
                className="text-accent-text underline-offset-4 hover:underline"
              >
                refunds policy
              </Link>
              .
              {!liveMode && (
                <> Razorpay is in test mode on this deployment — use a test card. No money moves.</>
              )}
            </p>
          </>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-fg-muted">
            Payments are not configured here. Set RAZORPAY_KEY_ID and
            RAZORPAY_KEY_SECRET to enable the payment sheet.
          </p>
        )}
      </div>
    </section>
  );
}
