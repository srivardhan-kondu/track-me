import type { Point } from "@/services/admin";
import { cn } from "@/lib/utils";

/**
 * One measure over time, as bars.
 *
 * One series per chart, and never two scales on one axis: sign-ups and rupees
 * are different measures, so they are different charts sitting side by side
 * rather than one clever chart with an axis on each edge. Height alone carries
 * magnitude — the fill is the system's single violet at one opacity, so a tall
 * bar is not also a darker one saying the same thing twice.
 *
 * The bars are labelled by their title attribute rather than by a number over
 * every column: thirty numbers is not a chart, it is a table drawn badly.
 */
export function TrendChart({
  label,
  points,
  format,
  headline,
  note,
  height = 96,
  className,
}: {
  label: string;
  points: Point[];
  /** Renders a value for the tooltip and the peak label. */
  format: (value: number) => string;
  /** The figure the chart is about, set large above it. */
  headline?: React.ReactNode;
  note?: React.ReactNode;
  height?: number;
  className?: string;
}) {
  const max = Math.max(...points.map((p) => p.value), 0);
  const empty = max === 0;
  const peak = points.findIndex((p) => p.value === max);

  const first = points[0]?.day;
  const last = points[points.length - 1]?.day;

  return (
    <section
      className={cn(
        "rounded-2xl border border-line-strong bg-surface p-[22px]",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="mono-label">{label}</p>
        {!empty && (
          <span className="tabular font-mono text-[11px] text-fg-dim">
            peak {format(max)}
          </span>
        )}
      </div>

      {headline !== undefined && (
        <p className="tabular mt-2.5 font-serif text-[30px] leading-none text-fg">
          {headline}
        </p>
      )}

      <div
        className="mt-5 flex items-end gap-[2px]"
        style={{ height }}
        role="img"
        aria-label={`${label}: ${points
          .map((p) => `${p.day} ${format(p.value)}`)
          .join(", ")}`}
      >
        {points.map((point, i) => {
          const ratio = max > 0 ? point.value / max : 0;
          return (
            <div
              key={point.day}
              title={`${point.day} · ${format(point.value)}`}
              className="flex h-full flex-1 items-end"
            >
              <div
                className={cn(
                  "w-full rounded-t-[4px] transition-colors",
                  point.value === 0
                    ? "bg-line-strong"
                    : i === peak
                      ? "bg-accent"
                      : "bg-accent/55",
                )}
                // A day with nothing on it stays a visible hairline on the
                // baseline rather than disappearing, so the gap is legible as
                // a zero rather than as missing data.
                style={{ height: `${Math.max(2, Math.round(ratio * 100))}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-baseline justify-between">
        <span className="font-mono text-[10.5px] text-fg-faint">{first}</span>
        <span className="font-mono text-[10.5px] text-fg-faint">{last}</span>
      </div>

      {note && (
        <p className="mt-3 text-[12px] leading-relaxed text-fg-dim">{note}</p>
      )}
    </section>
  );
}

/**
 * A proportion, as one bar split by state.
 *
 * Used for the account mix, where the parts sum to a whole that means
 * something — every account is in exactly one of four states — which is the
 * only case a stacked bar is honest.
 */
export function StackedBar({
  segments,
  className,
}: {
  segments: { label: string; value: number; className: string }[];
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  return (
    <div className={className}>
      {/* A 2px gap of the surface between segments, so adjacent fills of the
          same hue family still read as separate quantities. */}
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
        {segments
          .filter((s) => s.value > 0)
          .map((segment) => (
            <div
              key={segment.label}
              title={`${segment.label}: ${segment.value.toLocaleString()}`}
              className={cn("h-full first:rounded-l-full last:rounded-r-full", segment.className)}
              style={{ width: `${(segment.value / total) * 100}%` }}
            />
          ))}
      </div>

      <ul className="mt-3.5 flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2">
            <span
              className={cn("h-2 w-2 shrink-0 rounded-full", segment.className)}
            />
            <span className="text-[12px] text-fg-muted">{segment.label}</span>
            <span className="tabular font-mono text-[11px] text-fg-dim">
              {segment.value.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
