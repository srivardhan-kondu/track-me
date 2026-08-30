import { round } from "@/lib/utils";

export type Point = { day: Date; weightKg: number };

const W = 720;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 26, left: 40 };

/**
 * Weight trend as an inline SVG so it inherits the theme and ships no
 * charting library. Scales to its container via viewBox.
 */
export function WeightChart({ points }: { points: Point[] }) {
  if (points.length === 0) {
    return (
      <div className="grid h-[220px] place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        No check-ins yet — log your weight to start the trend.
      </div>
    );
  }

  if (points.length === 1) {
    return (
      <div className="grid h-[220px] place-items-center rounded-lg border border-dashed border-border">
        <div className="text-center">
          <p className="tabular text-3xl font-semibold">
            {points[0].weightKg}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              kg
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
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
  const min = rawMin - span * 0.15;
  const max = rawMax + span * 0.15;

  const times = points.map((p) => new Date(p.day).getTime());
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const tSpan = Math.max(1, tMax - tMin);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (t: number) => PAD.left + ((t - tMin) / tSpan) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH;

  const coords = points.map((p) => ({
    cx: x(new Date(p.day).getTime()),
    cy: y(p.weightKg),
    ...p,
  }));

  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.cx.toFixed(1)},${c.cy.toFixed(1)}`)
    .join(" ");

  const area =
    `${line} L${coords[coords.length - 1].cx.toFixed(1)},${(H - PAD.bottom).toFixed(1)}` +
    ` L${coords[0].cx.toFixed(1)},${(H - PAD.bottom).toFixed(1)} Z`;

  // Four horizontal gridlines across the padded domain.
  const ticks = Array.from({ length: 4 }, (_, i) => {
    const v = min + ((max - min) * i) / 3;
    return { v, y: y(v) };
  });

  const first = coords[0];
  const last = coords[coords.length - 1];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[220px] w-full min-w-[320px]"
        role="img"
        aria-label={`Weight trend from ${round(first.weightKg, 1)} to ${round(last.weightKg, 1)} kilograms`}
      >
        <defs>
          <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--primary)"
              stopOpacity="0.22"
            />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={t.y}
              y2={t.y}
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={t.y + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="var(--muted-foreground)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {t.v.toFixed(1)}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#weight-fill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.cx}
            cy={c.cy}
            r={i === coords.length - 1 ? 4 : 2.5}
            fill="var(--primary)"
            stroke="var(--card)"
            strokeWidth="1.5"
          >
            <title>
              {new Date(c.day).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
              : {c.weightKg} kg
            </title>
          </circle>
        ))}

        <text
          x={PAD.left}
          y={H - 8}
          fontSize="10"
          fill="var(--muted-foreground)"
        >
          {new Date(first.day).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </text>
        <text
          x={W - PAD.right}
          y={H - 8}
          textAnchor="end"
          fontSize="10"
          fill="var(--muted-foreground)"
        >
          {new Date(last.day).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </text>
      </svg>
    </div>
  );
}
