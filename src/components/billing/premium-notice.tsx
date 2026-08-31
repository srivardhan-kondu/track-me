import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The one way the app asks for money.
 *
 * Deliberately a hairline note rather than a modal or an overlay: the athlete
 * came here to train, and a paywall that interrupts that is a paywall they
 * resent. It states what is behind the plan and gets out of the way.
 */
export function PremiumNotice({
  title,
  body,
  className,
}: {
  title: string;
  body: string;
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
        See plans →
      </Link>
    </div>
  );
}
