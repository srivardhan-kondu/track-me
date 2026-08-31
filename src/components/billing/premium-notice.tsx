import Link from "next/link";

import { PRICES } from "@/lib/entitlements";
import { rupees } from "@/lib/plans";
import { cn } from "@/lib/utils";

/**
 * The one way the app asks for money.
 *
 * Deliberately a hairline note rather than a modal or an overlay: the athlete
 * came here to train, and a paywall that interrupts that is a paywall they
 * resent. It states what is behind the plan and gets out of the way.
 *
 * The price rides on the link rather than waiting behind it. ₹99 is a small
 * enough number that saying it here answers the question the note provokes,
 * where making somebody navigate to find it mostly loses them.
 */
export function PremiumNotice({
  title,
  body,
  cta,
  className,
}: {
  title: string;
  body: string;
  /** Overrides the default "from ₹99 a month" call to action. */
  cta?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-accent-line/60 bg-accent-soft p-[18px]",
        className,
      )}
    >
      <p className="text-[12.5px] font-semibold text-fg">{title}</p>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-fg-dim">{body}</p>
      <Link
        href="/dashboard/settings"
        className="mt-3 inline-flex text-[11.5px] font-medium text-accent-text underline-offset-4 hover:underline"
      >
        {cta ?? `See plans — from ${rupees(PRICES.MONTHLY)} a month`} →
      </Link>
    </div>
  );
}
