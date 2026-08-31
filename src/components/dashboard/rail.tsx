import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials, round } from "@/lib/utils";
import type { ComplianceDay, WeightPoint } from "@/services/reporting";

/** Latest weight with a bare sparkline — enough to see the direction. */
export function WeightRailCard({
  points,
  days,
}: {
  points: WeightPoint[];
  days: number;
}) {
  const latest = points[points.length - 1]?.weightKg ?? null;
  const first = points[0]?.weightKg ?? null;
  const change =
    latest !== null && first !== null && points.length > 1
      ? round(latest - first, 1)
      : null;

  const values = points.map((p) => p.weightKg);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = Math.max(0.4, max - min);

  const line = points
    .map((p, i) => {
      const x = points.length === 1 ? 240 : (i / (points.length - 1)) * 240;
      const y = 48 - ((p.weightKg - min) / span) * 40;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="rounded-2xl border border-line bg-surface p-[18px]">
      <div className="flex items-baseline justify-between">
        <p className="text-[12.5px] font-semibold text-fg">Weight</p>
        <p className="mono-label">{days} days</p>
      </div>

      {latest === null ? (
        <p className="mt-3 text-[12.5px] leading-relaxed text-fg-dim">
          No check-ins yet. One number today becomes your baseline.
        </p>
      ) : (
        <>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="tabular font-serif text-[30px] leading-none text-fg">
              {latest}
            </span>
            <span className="text-[12px] text-fg-dim">kg</span>
            {change !== null && (
              <span
                className={cn(
                  "tabular ml-auto font-mono text-[11.5px] font-medium",
                  change <= 0 ? "text-sage-text" : "text-fg-muted",
                )}
              >
                {change > 0 ? "+" : ""}
                {change}
              </span>
            )}
          </div>

          {points.length > 1 && (
            <svg
              viewBox="0 0 240 56"
              preserveAspectRatio="none"
              className="mt-3 h-14 w-full"
              aria-hidden="true"
            >
              <polyline
                points={line}
                fill="none"
                stroke="var(--sage)"
                strokeWidth="1.6"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
        </>
      )}
    </div>
  );
}

/** A week of logging at a glance: how full each day was. */
export function ConsistencyCard({ days }: { days: ComplianceDay[] }) {
  const scored = days.map((d) => ({
    day: d.day,
    score:
      (d.meals > 0 ? 1 : 0) + (d.workouts > 0 ? 1 : 0) + (d.weighedIn ? 1 : 0),
  }));

  const logged = scored.filter((d) => d.score > 0).length;

  return (
    <div className="rounded-2xl border border-line bg-surface p-[18px]">
      <p className="text-[12.5px] font-semibold text-fg">Consistency</p>

      <div className="mt-3.5 flex gap-1.5">
        {scored.map(({ day, score }) => (
          <div
            key={day.toISOString()}
            className="flex flex-1 flex-col items-center gap-2"
            title={`${day.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })} — ${score} of 3 logged`}
          >
            <div
              className={cn(
                "h-[30px] w-full rounded-[7px]",
                score === 0 && "bg-track",
                score === 1 && "bg-accent/35",
                score === 2 && "bg-accent/65",
                score === 3 && "bg-accent",
              )}
            />
            <span className="font-mono text-[10px] text-fg-faint">
              {day.toLocaleDateString(undefined, { weekday: "narrow" })}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11.5px] text-fg-dim">
        {logged} of {scored.length} days logged.
        {logged === scored.length
          ? " Not a day missed."
          : logged >= scored.length - 1
            ? " Quietly good."
            : ""}
      </p>
    </div>
  );
}

function relativeShort(date: Date): string {
  const hours = (Date.now() - date.getTime()) / 36e5;
  if (hours < 1) return "NOW";
  if (hours < 24) return `${Math.floor(hours)}H`;
  return `${Math.floor(hours / 24)}D`;
}

/** The most recent thing a coach said, pulled out of the timeline. */
export function CoachNoteCard({
  note,
}: {
  note: {
    body: string;
    createdAt: Date;
    author: { name: string | null; image: string | null };
  };
}) {
  return (
    <div className="rounded-2xl border border-sage-line bg-sage-soft p-[18px]">
      <div className="mb-2.5 flex items-center gap-2.5">
        <Avatar className="h-5 w-5">
          {note.author.image && <AvatarImage src={note.author.image} alt="" />}
          <AvatarFallback className="text-[8px]">
            {initials(note.author.name)}
          </AvatarFallback>
        </Avatar>
        <p className="min-w-0 truncate text-[12px] font-semibold text-fg">
          Note from {note.author.name?.split(" ")[0] ?? "your coach"}
        </p>
        <span className="ml-auto shrink-0 font-mono text-[10px] text-sage-text">
          {relativeShort(note.createdAt)}
        </span>
      </div>

      <p className="text-[12.5px] leading-relaxed text-fg-muted">{note.body}</p>
    </div>
  );
}
