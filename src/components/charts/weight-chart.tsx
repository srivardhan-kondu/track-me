import { trailingMeanByDay } from "@/lib/series";
import {
  displayWeight,
  weightLabel,
  type WeightUnit,
} from "@/lib/units";
import { cn } from "@/lib/utils";

export type Point = { day: Date; weightKg: number };

const W = 900;
const H = 210;

/** A week of trailing mean under the readings. */
const TREND_DAYS = 7;

/**
 * The weight trend as inline SVG, so it inherits the theme and ships no
 * charting library.
 *
 * Two series: the mornings as they were read, and a seven-day trailing mean
 * through them. The mean is the accent line and the readings are recessive
 * dots, because a single morning is mostly water and salt — the dots are there
 * to show how much scatter the trend was drawn through, not to be read one by
 * one. The shaded band is where the last week has actually been sitting, since
 * Track Me stores no goal weight to draw a line against.
 *
 * The geometry is done in the stored kilograms, which a change of unit cannot
 * move; only the figures printed along the way are converted.
 */
export function WeightChart({
  points,
  unit = "KG",
  className,
}: {
  points: Point[];
  unit?: WeightUnit;
  className?: string;
}) {
  if (points.length === 0) {
    return (
      <div
        className={cn(
          "grid h-[210px] place-items-center rounded-xl border border-dashed border-line-strong px-6 text-center",
          className,
        )}
      >
        <p className="text-[13px] leading-relaxed text-fg-dim">
          No check-ins yet. Weigh in tomorrow morning and the trend starts here.
        </p>
      </div>
    );
  }

  if (points.length === 1) {
    return (
      <div
        className={cn(
          "grid h-[210px] place-items-center rounded-xl border border-dashed border-line-strong px-6 text-center",
          className,
        )}
      >
        <div>
          <p className="tabular font-serif text-[42px] leading-none text-fg">
            {displayWeight(points[0].weightKg, unit)}
            <span className="ml-1.5 text-[13px] text-fg-dim">
              {weightLabel(unit)}
            </span>
          </p>
          <p className="mt-3 text-[12.5px] text-fg-dim">
            One more check-in and the trend line appears.
          </p>
        </div>
      </div>
    );
  }

  const values = points.map((p) => p.weightKg);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Pad the domain so the line never hugs the frame.
  const span = Math.max(1, rawMax - rawMin);
  const min = rawMin - span * 0.18;
  const max = rawMax + span * 0.18;

  const times = points.map((p) => new Date(p.day).getTime());
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const tSpan = Math.max(1, tMax - tMin);

  const x = (t: number) => ((t - tMin) / tSpan) * W;
  const y = (v: number) => (1 - (v - min) / (max - min)) * H;

  const coords = points.map((p) => ({
    cx: x(new Date(p.day).getTime()),
    cy: y(p.weightKg),
    ...p,
  }));

  // Smoothed by date rather than by point count, so a fortnight away from the
  // scale thins the window instead of stretching it across the gap.
  const trend = trailingMeanByDay(
    points.map((p) => ({ day: new Date(p.day), value: p.weightKg })),
    TREND_DAYS,
  );
  const trendCoords = trend.map((t) => ({
    cx: x(t.day.getTime()),
    cy: y(t.value),
    value: t.value,
  }));

  const line = trendCoords
    .map((c) => `${c.cx.toFixed(1)},${c.cy.toFixed(1)}`)
    .join(" ");

  // The same path closed along the baseline, so the area beneath can be filled.
  const area = `${trendCoords[0].cx.toFixed(1)},${H} ${line} ${trendCoords[trendCoords.length - 1].cx.toFixed(1)},${H}`;

  // Where the last week has actually sat — the band scales with the athlete's
  // own noise rather than a fixed half-kilo, which would swallow a flat chart.
  const recent = points.slice(-7).map((p) => p.weightKg);
  const recentLow = Math.min(...recent);
  const recentHigh = Math.max(...recent);
  const bandTop = y(recentHigh);
  const bandHeight = Math.max(3, y(recentLow) - bandTop);

  const last = trendCoords[trendCoords.length - 1];
  const first = trendCoords[0];

  const axis = [0, 1, 2, 3].map((i) => {
    const t = tMin + (tSpan * i) / 3;
    return new Date(t).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  });

  return (
    <div className={className}>
      <div className="relative h-[210px] w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-[210px] w-full"
          role="img"
          aria-label={`Seven-day weight trend from ${displayWeight(
            first.value,
            unit,
          )} to ${displayWeight(last.value, unit)} ${
            unit === "LB" ? "pounds" : "kilograms"
          }`}
        >
          {[0.2, 0.45, 0.7].map((f) => (
            <line
              key={f}
              x1={0}
              x2={W}
              y1={H * f}
              y2={H * f}
              stroke="var(--line-strong)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <rect
            x={0}
            y={bandTop}
            width={W}
            height={bandHeight}
            fill="var(--sage)"
            opacity="0.09"
          />
          {/* The violet wash under the trend, fading out toward the axis. */}
          <defs>
            <linearGradient id="weight-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.34" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#weight-area)" />

          <polyline
            points={line}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/*
          Markers sit in their own un-stretched overlay: the chart SVG uses
          preserveAspectRatio="none", which would squash a circle into an oval.
        */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {coords.map((c) => (
            <span
              key={c.day.toString()}
              className="absolute h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg-faint ring-2 ring-surface"
              style={{
                left: `${(c.cx / W) * 100}%`,
                top: `${(c.cy / H) * 100}%`,
              }}
            />
          ))}
        </div>

        {/* Drawn in HTML: the SVG is stretched, which would distort text. */}
        <span
          className="absolute right-0 -translate-y-1/2 rounded-md bg-accent px-2 py-[3px] font-mono text-[10.5px] font-semibold text-accent-ink"
          style={{ top: `${(last.cy / H) * 100}%` }}
        >
          {displayWeight(last.value, unit)}
        </span>

        <span className="mono-label absolute bottom-2.5 left-0">
          Last week {displayWeight(recentLow, unit)}–
          {displayWeight(recentHigh, unit)}
        </span>
      </div>

      {/* Two series, so identity never rests on colour alone. */}
      <div className="mt-2 flex items-center justify-end gap-3.5">
        <span className="flex items-center gap-1.5 text-[10.5px] text-fg-dim">
          <span className="h-[8px] w-[8px] rounded-full bg-fg-faint" />
          Daily
        </span>
        <span className="flex items-center gap-1.5 text-[10.5px] text-fg-dim">
          <span className="h-[2px] w-4 rounded-full bg-accent" />
          {TREND_DAYS}-day trend
        </span>
      </div>

      <div className="mt-1.5 flex justify-between border-t border-line pt-2.5">
        {axis.map((label, i) => (
          <span key={i} className="mono-label">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
