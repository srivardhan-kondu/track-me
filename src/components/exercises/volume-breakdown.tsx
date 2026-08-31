import { AlertCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PATTERN_LABELS } from "@/../prisma/data/taxonomy";
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
      <div className="rounded-xl border border-dashed border-line-strong px-6 py-8 text-center">
        <p className="text-[13px] font-semibold text-fg">
          No attributed volume yet
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-fg-dim">
          Log a workout and each set is credited to the muscles it trains.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-x-8 gap-y-3.5 lg:grid-cols-2">
        {report.groups.map((group) => {
          const direct = Math.min(100, (group.directSets / max) * 100);
          const assisting = Math.min(
            100 - direct,
            ((group.sets - group.directSets) / max) * 100,
          );

          return (
            <div key={group.groupId}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] font-medium text-fg-muted">
                  {group.name}
                </span>
                <span className="tabular font-mono text-[11px] text-fg-dim">
                  {group.sets} sets
                  {group.sets !== group.directSets && (
                    <span className="ml-1 text-fg-faint">
                      ({group.directSets} direct)
                    </span>
                  )}
                </span>
              </div>

              <div className="mt-1.5 flex h-[5px] w-full overflow-hidden rounded-full bg-track">
                {/* Direct work, then assisting work in a lighter tone. */}
                <div className="bg-accent" style={{ width: `${direct}%` }} />
                <div className="bg-accent/40" style={{ width: `${assisting}%` }} />
              </div>

              <p className="mt-1.5 truncate text-[11px] text-fg-faint">
                {group.exercises.slice(0, 4).join(" · ")}
                {group.exercises.length > 4 &&
                  ` +${group.exercises.length - 4}`}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
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
        <p className="flex items-start gap-2.5 rounded-xl border border-dashed border-line-strong p-3.5 text-[11.5px] leading-relaxed text-fg-dim">
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
