import { AlertCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PATTERN_LABELS } from "@/../prisma/data/taxonomy";
import { cn } from "@/lib/utils";
import { pushPullBalance, type VolumeReport } from "@/services/exercises/volume";

/** Rough weekly landmarks for direct sets per muscle group. */
const TARGET_SETS = 10;

function patternLabel(pattern: string): string {
  return (
    PATTERN_LABELS[pattern as keyof typeof PATTERN_LABELS] ??
    pattern.replace(/_/g, " ").toLowerCase()
  );
}

export function VolumeBreakdown({
  report,
  days,
}: {
  report: VolumeReport;
  days: number;
}) {
  const balance = pushPullBalance(report.patterns);
  const max = Math.max(TARGET_SETS, ...report.groups.map((g) => g.sets));

  if (report.groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
        <p className="text-sm font-medium">No attributed volume yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Log a workout and each set is credited to the muscles it trains.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        {report.groups.map((group) => (
          <div key={group.groupId}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{group.name}</span>
              <span className="tabular text-xs text-muted-foreground">
                {group.sets} sets
                {group.sets !== group.directSets && (
                  <span className="ml-1 opacity-70">
                    ({group.directSets} direct)
                  </span>
                )}
              </span>
            </div>

            <div className="mt-1 flex h-2 w-full overflow-hidden rounded-full bg-muted">
              {/* Direct work, then assisting work in a lighter tone. */}
              <div
                className="bg-primary"
                style={{ width: `${Math.min(100, (group.directSets / max) * 100)}%` }}
              />
              <div
                className="bg-primary/40"
                style={{
                  width: `${Math.min(
                    100 - Math.min(100, (group.directSets / max) * 100),
                    ((group.sets - group.directSets) / max) * 100,
                  )}%`,
                }}
              />
            </div>

            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {group.exercises.slice(0, 4).join(" · ")}
              {group.exercises.length > 4 && ` +${group.exercises.length - 4}`}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {balance && (
          <Badge
            variant={
              balance.ratio > 1.6 || balance.ratio < 0.6 ? "warning" : "success"
            }
          >
            Push {balance.push} : Pull {balance.pull}
            {balance.ratio > 1.6 && " — pulling is lagging"}
            {balance.ratio < 0.6 && " — pushing is lagging"}
          </Badge>
        )}

        {report.patterns.slice(0, 4).map((p) => (
          <Badge key={p.pattern} variant="secondary">
            {patternLabel(p.pattern)} {p.sets}
          </Badge>
        ))}
      </div>

      {report.unattributedSets > 0 && (
        <p
          className={cn(
            "flex items-start gap-2 rounded-lg border border-dashed border-border",
            "bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground",
          )}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {report.unattributedSets} of {report.totalSets} sets in the last{" "}
            {days} days could not be matched to a known exercise, so they are
            not counted above.
          </span>
        </p>
      )}
    </div>
  );
}
