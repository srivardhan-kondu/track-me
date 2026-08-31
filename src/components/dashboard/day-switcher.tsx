import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Prev / today / next, as one hairline control rather than three buttons.
 * Forward is inert once you are already on today.
 */
export function DaySwitcher({
  prevHref,
  todayHref,
  nextHref,
  isToday,
  label = "Today",
}: {
  prevHref: string;
  todayHref: string;
  nextHref: string;
  isToday: boolean;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-[11px] border border-line p-1">
      <Link
        href={prevHref}
        aria-label="Previous day"
        className="grid h-7 w-[30px] place-items-center rounded-[8px] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>

      <Link
        href={todayHref}
        aria-current={isToday ? "page" : undefined}
        className={cn(
          "flex h-7 items-center rounded-[8px] px-3 text-[12px] transition-colors",
          isToday
            ? "bg-hover font-semibold text-fg"
            : "font-medium text-fg-muted hover:bg-hover hover:text-fg",
        )}
      >
        {label}
      </Link>

      {isToday ? (
        <span
          aria-hidden="true"
          className="grid h-7 w-[30px] place-items-center rounded-[8px] text-line-strong"
        >
          <ChevronRight className="h-4 w-4" />
        </span>
      ) : (
        <Link
          href={nextHref}
          aria-label="Next day"
          className="grid h-7 w-[30px] place-items-center rounded-[8px] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
