import Link from "next/link";

import { PRICES } from "@/lib/entitlements";
import { rupees } from "@/lib/plans";

/**
 * The last few days of the free trial, said out loud.
 *
 * Every account is given Premium for its first week, and until now that ended
 * in silence — history quietly shortened, photographs quietly stopped, and the
 * athlete was left to work out what had changed. This is the one moment where
 * somebody has already felt what the plan does, so it is the only place in the
 * app that is allowed to interrupt, and even then only in the final days.
 */
export const WARN_WITHIN_DAYS = 3;

export function TrialStrip({ daysLeft }: { daysLeft: number }) {
  if (daysLeft > WARN_WITHIN_DAYS) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[14px] border border-accent-line bg-accent-soft px-4 py-2.5">
      <p className="text-[12.5px] font-semibold text-fg">
        {daysLeft === 1 ? "Your trial ends today" : `${daysLeft} days of Premium left`}
      </p>

      <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-fg-dim">
        After that this account keeps logging, but history shortens, meals stop
        being read properly and progress photos pause.
      </p>

      <Link
        href="/dashboard/settings"
        className="shrink-0 text-[11.5px] font-medium text-accent-text underline-offset-4 hover:underline"
      >
        Keep it — from {rupees(PRICES.MONTHLY)} a month →
      </Link>
    </div>
  );
}
