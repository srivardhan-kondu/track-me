import { cn } from "@/lib/utils";
import type { ComplianceDay } from "@/services/reporting";

/**
 * A fortnight of logging as a calendar grid: one cell per day, warmer the
 * more that day held.
 */
export function ComplianceStrip({
  days,
  caption,
}: {
  days: ComplianceDay[];
  caption?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const score =
            (d.meals > 0 ? 1 : 0) +
            (d.workouts > 0 ? 1 : 0) +
            (d.weighedIn ? 1 : 0);

          return (
            <div
              key={d.day.toISOString()}
              className={cn(
                "h-4 rounded-[3px]",
                score === 0 && "bg-track",
                score === 1 && "bg-accent/35",
                score === 2 && "bg-accent/65",
                score === 3 && "bg-accent",
              )}
              title={`${d.day.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })} — ${d.meals} meal${d.meals === 1 ? "" : "s"}, ${
                d.workouts
              } workout${d.workouts === 1 ? "" : "s"}${
                d.weighedIn ? ", weighed in" : ""
              }`}
            />
          );
        })}
      </div>

      {caption ? (
        <p className="text-[12px] leading-relaxed text-fg-dim">{caption}</p>
      ) : (
        <div className="flex justify-between">
          <span className="mono-label">
            {days[0]?.day.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
          <span className="mono-label">Today</span>
        </div>
      )}
    </div>
  );
}
