"use client";

import * as React from "react";

import { band } from "@/lib/series";
import { cn } from "@/lib/utils";

/**
 * The five steps of the heat ramp, dimmest first. Defined in globals.css and
 * validated there as an ordinal ramp; a sixth step would break the lightness
 * gaps that keep two neighbouring bands apart.
 */
const STEPS = 5;
const FILL = [
  "var(--heat-1)",
  "var(--heat-2)",
  "var(--heat-3)",
  "var(--heat-4)",
  "var(--heat-5)",
];
/** Nothing logged. Deliberately off the ramp, not the bottom of it. */
const NOTHING = "var(--track)";

type Region = {
  group: string;
  /** Rounded rectangles and ellipses only — this is a diagram, not a plate. */
  shape:
    | { kind: "rect"; x: number; y: number; w: number; h: number; r: number }
    | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number };
};

const rect = (group: string, x: number, y: number, w: number, h: number, r = 4): Region => ({
  group,
  shape: { kind: "rect", x, y, w, h, r },
});
const ellipse = (group: string, cx: number, cy: number, rx: number, ry: number): Region => ({
  group,
  shape: { kind: "ellipse", cx, cy, rx, ry },
});

/**
 * The figure seen from the front, at x-centre 48.
 *
 * Proportions are schematic but not arbitrary: the chest is wider than the
 * waist so the torso tapers, the arms touch the torso rather than floating
 * beside it, and the thighs start where the waist ends. A body that reads as a
 * body is the whole point — the moment it reads as stacked blocks, the map
 * stops being easier to scan than the list next to it.
 */
const FRONT: Region[] = [
  rect("neck", 44, 20, 8, 8, 3),
  ellipse("shoulders", 31, 36, 8, 6.5),
  ellipse("shoulders", 65, 36, 8, 6.5),
  rect("chest", 35, 31, 12, 16, 4),
  rect("chest", 49, 31, 12, 16, 4),
  rect("core", 38, 49, 20, 26, 5),
  rect("arms", 24, 42, 11, 20, 5),
  rect("arms", 61, 42, 11, 20, 5),
  rect("arms", 25, 64, 10, 20, 5),
  rect("arms", 61, 64, 10, 20, 5),
  rect("legs", 35, 78, 11, 32, 5),
  rect("legs", 50, 78, 11, 32, 5),
  rect("legs", 36, 112, 9, 26, 4),
  rect("legs", 51, 112, 9, 26, 4),
];

/** The same figure from behind, every x shifted by 104. */
const BACK: Region[] = [
  rect("neck", 148, 20, 8, 8, 3),
  ellipse("shoulders", 135, 36, 8, 6.5),
  ellipse("shoulders", 169, 36, 8, 6.5),
  rect("back", 139, 31, 26, 15, 4),
  rect("back", 141, 47, 22, 14, 4),
  rect("glutes", 141, 63, 22, 13, 6),
  rect("arms", 128, 42, 11, 20, 5),
  rect("arms", 165, 42, 11, 20, 5),
  rect("arms", 129, 64, 10, 20, 5),
  rect("arms", 165, 64, 10, 20, 5),
  rect("legs", 139, 78, 11, 32, 5),
  rect("legs", 154, 78, 11, 32, 5),
  rect("legs", 140, 112, 9, 26, 4),
  rect("legs", 155, 112, 9, 26, 4),
];

export type MuscleMapGroup = { key: string; name: string; sets: number };

/**
 * Where the week's work actually landed, drawn on the body it landed on.
 *
 * The list beside a volume breakdown says how much each group got; this says
 * where — and the thing it is good at is the absence. A group nobody trained
 * is a dark patch on a lit figure, which is read in a glance and is exactly
 * what a table of eight rows fails to communicate.
 *
 * Fill is magnitude, so it takes one hue in five ordered steps rather than a
 * colour per group: the position on the body already carries identity, and
 * spending hue on it as well would leave nothing to say "how much".
 */
export function MuscleMap({
  groups,
  className,
}: {
  groups: MuscleMapGroup[];
  className?: string;
}) {
  const [active, setActive] = React.useState<string | null>(null);

  const byKey = new Map(groups.map((g) => [g.key, g]));
  const max = Math.max(...groups.map((g) => g.sets), 0);
  const total = groups.reduce((a, g) => a + g.sets, 0);

  const fillFor = (key: string) => {
    const sets = byKey.get(key)?.sets ?? 0;
    const i = band(sets, max, STEPS);
    return i < 0 ? NOTHING : FILL[i];
  };

  const shown = active ? byKey.get(active) : null;

  function Figure({ regions, label }: { regions: Region[]; label: string }) {
    return (
      <g>
        {regions.map((region, i) => {
          const common = {
            fill: fillFor(region.group),
            // A 2px surface gap between touching regions — the separation is
            // negative space, never a stroke drawn round the mark.
            stroke: "var(--surface)",
            strokeWidth: 2,
            className: cn(
              "transition-opacity",
              active && active !== region.group ? "opacity-35" : "opacity-100",
            ),
            onMouseEnter: () => setActive(region.group),
            onFocus: () => setActive(region.group),
          };

          return region.shape.kind === "rect" ? (
            <rect
              key={`${label}-${i}`}
              x={region.shape.x}
              y={region.shape.y}
              width={region.shape.w}
              height={region.shape.h}
              rx={region.shape.r}
              {...common}
            />
          ) : (
            <ellipse
              key={`${label}-${i}`}
              cx={region.shape.cx}
              cy={region.shape.cy}
              rx={region.shape.rx}
              ry={region.shape.ry}
              {...common}
            />
          );
        })}
      </g>
    );
  }

  return (
    <div className={className}>
      <div className="relative" onMouseLeave={() => setActive(null)}>
        <svg
          viewBox="0 0 200 158"
          className="h-auto w-full max-w-[280px]"
          role="img"
          aria-label={`Sets by muscle group: ${groups
            .map((g) => `${g.name} ${g.sets}`)
            .join(", ")}`}
        >
          {/*
            Heads orient the figure and carry no data, so they are outlines —
            a filled head would read as another region, and a dark filled one
            would read as a region nobody trained.
          */}
          <circle
            cx="48"
            cy="12"
            r="9"
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth="1.5"
          />
          <circle
            cx="152"
            cy="12"
            r="9"
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth="1.5"
          />

          <Figure regions={FRONT} label="front" />
          <Figure regions={BACK} label="back" />

          <text x="48" y="154" textAnchor="middle" className="fill-fg-faint text-[7px]">
            FRONT
          </text>
          <text x="152" y="154" textAnchor="middle" className="fill-fg-faint text-[7px]">
            BACK
          </text>
        </svg>

        {shown && (
          <div className="pointer-events-none absolute right-0 top-0 rounded-[10px] border border-line-strong bg-surface-raised px-3 py-2">
            <p className="text-[11.5px] font-semibold text-fg">{shown.name}</p>
            <p className="tabular mt-0.5 font-mono text-[11px] text-fg-dim">
              {shown.sets} sets
              {total > 0 && ` · ${Math.round((shown.sets / total) * 100)}%`}
            </p>
          </div>
        )}
      </div>

      {/* A magnitude scale needs its legend; the steps mean nothing alone. */}
      <div className="mt-3 flex items-center gap-2">
        <span className="mono-label">Less</span>
        <div className="flex gap-[2px]">
          <span
            className="h-2 w-4 rounded-[2px]"
            style={{ background: NOTHING }}
            title="No sets logged"
          />
          {FILL.map((fill) => (
            <span
              key={fill}
              className="h-2 w-4 rounded-[2px]"
              style={{ background: fill }}
            />
          ))}
        </div>
        <span className="mono-label">
          More{max > 0 && ` · ${max} sets`}
        </span>
      </div>
    </div>
  );
}
