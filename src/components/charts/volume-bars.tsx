import { cn } from "@/lib/utils";

export type VolumeBar = { label: string; value: number };

/**
 * Tonnage per week. The current week takes the full accent; the weeks behind
 * it fade back in proportion to how much was moved.
 */
export function VolumeBars({
  bars,
  caption,
  className,
}: {
  bars: VolumeBar[];
  caption?: React.ReactNode;
  className?: string;
}) {
  const max = Math.max(...bars.map((b) => b.value), 0.1);
  const empty = bars.every((b) => b.value === 0);

  return (
    <div className={className}>
      {/* Capped and spread, so a five-week window reads as bars, not slabs. */}
      <div className="flex h-[120px] items-end justify-between gap-3">
        {bars.map((bar, i) => {
          const current = i === bars.length - 1;
          const height = Math.max(4, Math.round((bar.value / max) * 100));

          return (
            <div
              key={bar.label}
              className="flex h-full max-w-[84px] flex-1 flex-col justify-end gap-2.5"
              title={`${bar.label}: ${bar.value.toFixed(1)} t`}
            >
              <div
                className={cn(
                  "w-full rounded-t-[5px]",
                  empty ? "hatched opacity-45" : "bg-accent",
                )}
                style={{
                  height: `${empty ? 45 + i * 8 : height}%`,
                  opacity: empty ? undefined : current ? 1 : 0.3 + (bar.value / max) * 0.3,
                }}
              />
              <span
                className={cn(
                  "text-center font-mono text-[10px]",
                  current ? "font-medium text-fg-muted" : "text-fg-faint",
                )}
              >
                {bar.label}
              </span>
            </div>
          );
        })}
      </div>

      {caption && (
        <p className="mt-3.5 text-[12px] leading-relaxed text-fg-dim">
          {caption}
        </p>
      )}
    </div>
  );
}
