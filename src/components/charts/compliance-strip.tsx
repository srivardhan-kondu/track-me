import { cn } from "@/lib/utils";
import type { ComplianceDay } from "@/services/reporting";

/** One cell per day: colour intensity shows how much was logged. */
export function ComplianceStrip({ days }: { days: ComplianceDay[] }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {days.map((d) => {
          const score =
            (d.meals > 0 ? 1 : 0) +
            (d.workouts > 0 ? 1 : 0) +
            (d.weighedIn ? 1 : 0);

          const tone =
            score === 0
              ? "bg-muted"
              : score === 1
                ? "bg-primary/25"
                : score === 2
                  ? "bg-primary/55"
                  : "bg-primary";

          return (
            <div
              key={d.day.toISOString()}
              className={cn("h-8 flex-1 rounded", tone)}
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

      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>
          {days[0]?.day.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}
