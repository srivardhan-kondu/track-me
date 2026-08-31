import { formatWater, hydrationPct } from "@/lib/hydration";
import { cn } from "@/lib/utils";
import type { WaterPoint } from "@/services/reporting";

/**
 * A day per bar, filled against the goal, with the goal itself drawn across
 * them as a line.
 *
 * The scale is the goal rather than the biggest day, so the line stays where
 * the eye expects it and a single heavy day cannot quietly rescale the week
 * into looking worse than it was. Anything over the goal simply fills its bar.
 */
export function WaterBars({
  points,
  goalMl,
  className,
}: {
  /** One entry per logged day; days with nothing logged may be absent. */
  points: { day: Date; ml: number }[];
  goalMl: number;
  className?: string;
}) {
  const empty = points.every((p) => p.ml === 0);

  return (
    <div className={className}>
      <div className="relative flex h-[140px] items-end gap-[3px]">
        {/* The goal, at the top of the track every bar fills. */}
        <span
          className="absolute inset-x-0 top-0 border-t border-dashed border-line-strong"
          aria-hidden="true"
        />

        {points.map((p) => {
          const pct = hydrationPct(p.ml, goalMl);
          const met = p.ml >= goalMl && p.ml > 0;

          return (
            <div
              key={p.day.toISOString()}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
              title={`${p.day.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })} — ${formatWater(p.ml)}`}
            >
              <div
                className={cn(
                  "w-full rounded-t-[4px]",
                  p.ml === 0 ? "bg-track" : met ? "bg-blue" : "bg-blue/45",
                )}
                style={{ height: `${p.ml === 0 ? 2 : Math.max(4, pct)}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-baseline justify-between">
        <span className="mono-label">
          {points[0]?.day.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })}
        </span>
        <span className="tabular font-mono text-[10.5px] text-fg-dim">
          {empty ? "nothing logged yet" : `goal ${formatWater(goalMl)}`}
        </span>
        <span className="mono-label">Today</span>
      </div>
    </div>
  );
}

/** Fills the gaps in a sparse series so every day in the window gets a bar. */
export function fillDays(
  points: WaterPoint[],
  days: Date[],
): { day: Date; ml: number }[] {
  const byKey = new Map(points.map((p) => [p.day.toISOString().slice(0, 10), p.ml]));
  return days.map((day) => ({
    day,
    ml: byKey.get(day.toISOString().slice(0, 10)) ?? 0,
  }));
}
