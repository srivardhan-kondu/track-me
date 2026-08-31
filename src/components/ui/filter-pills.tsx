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
        "flex items-center gap-1 rounded-full border border-line bg-surface-muted p-1",
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
              "flex h-8 items-center rounded-full px-4 text-[12px] transition-colors",
              selected
                ? "bg-accent font-semibold text-accent-ink"
                : "font-medium text-fg-muted hover:text-fg",
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
              "rounded-full px-4 py-[8px] text-[12px] transition-colors",
              selected
                ? "bg-accent font-semibold text-accent-ink"
                : "border border-line font-medium text-fg-muted hover:border-accent-line hover:text-fg",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
