import Link from "next/link";

import { cn } from "@/lib/utils";

/** A segmented control made of links — a time window, a view. */
export function SegmentedLinks({
  options,
  active,
  className,
}: {
  options: { label: string; value: string; href: string }[];
  active: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-[11px] border border-line p-1",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === active;
        return (
          <Link
            key={option.value}
            href={option.href}
            aria-current={selected ? "true" : undefined}
            className={cn(
              "flex h-7 items-center rounded-[8px] px-3 text-[12px] transition-colors",
              selected
                ? "bg-hover font-semibold text-fg"
                : "font-medium text-fg-muted hover:bg-hover hover:text-fg",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Hairline pills that filter a list by writing to the URL. */
export function FilterPills({
  options,
  active,
  className,
}: {
  options: { label: string; value: string | null; href: string }[];
  active: string | null;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const selected = option.value === active;
        return (
          <Link
            key={option.label}
            href={option.href}
            aria-current={selected ? "true" : undefined}
            className={cn(
              "rounded-full px-3.5 py-[7px] text-[12px] transition-colors",
              selected
                ? "bg-surface-inset font-semibold text-fg"
                : "border border-line font-medium text-fg-muted hover:bg-hover hover:text-fg",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
