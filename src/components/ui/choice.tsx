"use client";

import { cn } from "@/lib/utils";

/**
 * A pickable tile. Used wherever a choice deserves a sentence of explanation
 * rather than a bare radio — modes, poses, roles.
 */
export function ChoiceTile({
  title,
  blurb,
  selected,
  disabled,
  onClick,
  adornment,
  className,
}: {
  title: string;
  blurb?: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  /** Sits opposite the title — a spinner, a word, a dot. */
  adornment?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "rounded-xl border p-3.5 text-left transition-colors disabled:opacity-60",
        selected
          ? "border-accent-line bg-accent-soft"
          : "border-line-strong hover:bg-hover",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-[13px] font-semibold",
            selected ? "text-fg" : "text-fg-muted",
          )}
        >
          {title}
        </span>

        {adornment ??
          (selected ? (
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-accent" />
          ) : null)}
      </div>

      {blurb && (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-fg-dim">
          {blurb}
        </p>
      )}
    </button>
  );
}
