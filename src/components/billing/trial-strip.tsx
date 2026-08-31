import Link from "next/link";

import { CheckoutButton } from "@/components/billing/checkout-button";
import { PRICES } from "@/lib/entitlements";
import { rupees } from "@/lib/plans";
import { checkoutEnabled } from "@/lib/razorpay";
import { cn } from "@/lib/utils";

/**
 * The free trial, said out loud, with the way to keep it attached.
 *
 * Every account is given Premium for its first week, and that used to end in
 * silence — history quietly shortened, photographs quietly stopped, and the
 * athlete left to work out what had changed.
 *
 * It runs for the whole trial rather than only the last days, because somebody
 * three days in is enjoying the thing they would be paying for, and that is a
 * better moment to ask than the morning it is taken away. The button opens
 * Razorpay here rather than linking to Settings: a page in between is a place
 * to lose people who had already decided.
 */
export const URGENT_WITHIN_DAYS = 3;

export function TrialStrip({ daysLeft }: { daysLeft: number }) {
  const urgent = daysLeft <= URGENT_WITHIN_DAYS;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[14px] border px-4 py-3",
        urgent
          ? "border-accent-line bg-accent-soft"
          : "border-line-strong bg-surface",
      )}
    >
      <p className="text-[12.5px] font-semibold text-fg">
        {daysLeft === 1
          ? "Your trial ends today"
          : `${daysLeft} days of Premium left`}
      </p>

      <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-fg-dim">
        {urgent
          ? "After that this account keeps logging, but history shortens, meals stop being read properly and progress photos pause."
          : "Subscribe now and nothing changes when the trial runs out — your history, photos and analysis carry straight on."}
      </p>

      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/dashboard/settings"
          className="text-[11.5px] font-medium text-fg-dim underline-offset-4 transition-colors hover:text-fg hover:underline"
        >
          All plans
        </Link>

        {/* No keys, no button — a dead payment sheet is worse than a link. */}
        {checkoutEnabled && (
          <CheckoutButton
            term="MONTHLY"
            label={`Upgrade — ${rupees(PRICES.MONTHLY)}/month`}
          />
        )}
      </div>
    </div>
  );
}
