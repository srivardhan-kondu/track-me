import { cn } from "@/lib/utils";

/**
 * Estimated one-rep max over a handful of sessions.
 *
 * The vertical scale spans the data rather than starting at zero: a lifter
 * going from 100kg to 107kg has made real progress, and a zero-based axis
 * flattens it into a straight line.
 */
export function StrengthLine({
  points,
  className,
}: {
  points: { e1rm: number }[];
  className?: string;
}) {
  if (points.length < 2) return null;

  const values = points.map((p) => p.e1rm);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat run would divide by zero; give it a nominal band and centre it.
  const span = max - min || 1;

  const W = 100;
  const H = 32;
  const coords = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / span) * (H - 6) - 3;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const last = coords[coords.length - 1].split(",");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("h-9 w-full", className)}
      aria-hidden
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r="2" fill="currentColor" />
    </svg>
  );
}
