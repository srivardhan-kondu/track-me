"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * How a session divided itself between muscle groups.
 *
 * A share rather than a count, because the question this answers is "what was
 * this session *for*" — 87% legs says leg day in a way that "13 weighted sets"
 * does not. The groups that took the work sit at the top and the long tail
 * folds away, since nobody needs to be told a leg session touched 1% chest
 * unless they go looking.
 */

/** Groups shown before the list folds. Three is what fits without scrolling. */
const SHOWN = 3;

export type SplitRow = { key: string; name: string; sets: number };

export function MuscleSplit({
  groups,
  className,
}: {
  groups: SplitRow[];
  className?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);

  const total = groups.reduce((a, g) => a + g.sets, 0);
  if (total <= 0) return null;

  const ranked = [...groups].sort((a, b) => b.sets - a.sets);
  const shown = expanded ? ranked : ranked.slice(0, SHOWN);
  const hidden = ranked.length - shown.length;

  return (
    <section className={className}>
      <h2 className="text-[13px] font-semibold text-fg">Muscle split</h2>

      <ul className="mt-4 flex flex-col gap-3.5">
        {shown.map((group) => {
          // Rounded for the label but not for the bar, so a 0.4% group still
          // draws a sliver rather than vanishing into the track.
          const share = (group.sets / total) * 100;

          return (
            <li key={group.key}>
              <p className="text-[13px] text-fg">{group.name}</p>
              <div className="mt-1.5 flex items-center gap-3">
                <span
                  className="h-[18px] rounded-[5px] bg-accent"
                  style={{ width: `${Math.max(share, 1.5)}%` }}
                />
                <span className="tabular shrink-0 text-[12.5px] text-fg-dim">
                  {share < 1 ? "<1" : Math.round(share)}%
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {ranked.length > SHOWN && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className={cn(
            "mt-3.5 text-[13px] font-semibold text-accent-text transition-colors hover:text-accent-strong",
          )}
        >
          {expanded ? "Show less" : `Show ${hidden} more`}
        </button>
      )}
    </section>
  );
}
