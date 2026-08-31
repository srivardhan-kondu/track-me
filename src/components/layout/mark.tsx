import { cn } from "@/lib/utils";

/**
 * The Track Me mark: a ring caught mid-lap with its leading dot broken free —
 * a lap in progress rather than a closed circle.
 *
 * Drawn once here so the nav lockup, the install prompts and the offline
 * notice all show the same shape the home-screen icon does. The geometry is
 * mirrored in scripts/generate-icons.mjs, which rasterises it to PNG; change
 * one and change the other.
 */
export function Mark({
  size = 26,
  className,
  label,
}: {
  size?: number;
  className?: string;
  /** Give the mark a name when it stands alone, without the wordmark beside it. */
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect width="32" height="32" rx="9" className="fill-accent" />
      <path
        d="M12.76 9.91A6.9 6.9 0 1 0 21.72 12.14"
        className="fill-none stroke-accent-ink"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="17.67" cy="9.3" r="1.85" className="fill-accent-ink" />
    </svg>
  );
}
