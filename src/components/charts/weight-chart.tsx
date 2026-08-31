import { cn, round } from "@/lib/utils";

export type Point = { day: Date; weightKg: number };

const W = 900;
const H = 210;

/**
 * The weight trend as inline SVG, so it inherits the theme and ships no
 * charting library.
 *
 * The shaded band is where the last week has actually been sitting — the line
 * to notice, since Track Me stores no goal weight to draw one against.
 */
export function WeightChart({
  points,
  className,
}: {
  points: Point[];
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
            {points[0].weightKg}
            <span className="ml-1.5 text-[13px] text-fg-dim">kg</span>
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

  const line = coords.map((c) => `${c.cx.toFixed(1)},${c.cy.toFixed(1)}`).join(" ");

  // The same path closed along the baseline, so the area beneath can be filled.
  const area = `${coords[0].cx.toFixed(1)},${H} ${line} ${coords[coords.length - 1].cx.toFixed(1)},${H}`;

  // Where the last week has actually sat — the band scales with the athlete's
  // own noise rather than a fixed half-kilo, which would swallow a flat chart.
  const recent = points.slice(-7).map((p) => p.weightKg);
  const recentAvg = recent.reduce((a, v) => a + v, 0) / Math.max(1, recent.length);
  const recentLow = Math.min(...recent);
  const recentHigh = Math.max(...recent);
  const bandTop = y(recentHigh);
  const bandHeight = Math.max(3, y(recentLow) - bandTop);

  const last = coords[coords.length - 1];
  const first = coords[0];

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
          aria-label={`Weight trend from ${round(first.weightKg, 1)} to ${round(last.weightKg, 1)} kilograms`}
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
          <line
            x1={0}
            x2={W}
            y1={y(recentAvg)}
            y2={y(recentAvg)}
            stroke="var(--sage)"
            strokeWidth="1"
            strokeDasharray="5 6"
            opacity="0.6"
            vectorEffect="non-scaling-stroke"
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
            strokeWidth="2.2"
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
              className="absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-bg"
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
          {last.weightKg}
        </span>

        <span className="mono-label absolute bottom-2.5 left-0">
          Last week {round(recentLow, 1)}–{round(recentHigh, 1)}
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
