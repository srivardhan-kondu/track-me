import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { groupExercises } from "@/lib/exercise-groups";
import { formatLength } from "@/lib/live-session";
import { formatLoad, type WeightUnit } from "@/lib/units";
import { cn, tonnesLifted } from "@/lib/utils";
import type { TimelineWorkout } from "@/services/reporting";

/**
 * A session as a card, not as a session.
 *
 * Printing every set of every movement on the training page turned it into a
 * wall: ten sessions of five movements is a hundred and fifty numbers, and
 * nobody scrolling their history is reading any of them. So the card carries
 * the three figures that say how it went and the first few movements to say
 * what it was, and the sets — which are the point, but only once you have
 * chosen a session — live one tap away on the detail page.
 */

/** Movements listed before the card defers to the detail page. */
const PREVIEW = 3;

/** A stable tint per session name, so a training split reads by colour. */
const TINTS = [
  "bg-blue-soft text-blue-text",
  "bg-sage-soft text-sage-text",
  "bg-clay-soft text-clay-text",
  "bg-accent-soft text-accent-text",
] as const;

function tint(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

function mark(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "WO";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function SessionCard({
  workout,
  when,
  unit = "KG",
}: {
  unit?: WeightUnit;
  workout: TimelineWorkout;
  /** Mono meta line: when it happened. */
  when: string;
}) {
  const title = workout.title ?? "Workout";
  const groups = groupExercises(workout.exercises);
  const sets = groups.reduce((a, g) => a + g.workingSets, 0);
  const tonnes = tonnesLifted(workout.exercises);

  const shown = groups.slice(0, PREVIEW);
  const hidden = groups.length - shown.length;

  return (
    <Link
      href={`/dashboard/workouts/${workout.id}`}
      className="group flex flex-col rounded-[14px] border border-line bg-surface-muted p-4 transition-colors hover:border-line-strong hover:bg-surface"
    >
      <div className="flex items-center gap-3.5">
        <span
          className={cn(
            "grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] font-mono text-[11px] font-semibold",
            tint(title),
          )}
        >
          {mark(title)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-fg">
            {title}
          </span>
          <span className="mt-1 block truncate font-mono text-[11px] uppercase tracking-[0.06em] text-fg-dim">
            {when}
          </span>
        </span>

        <ChevronRight className="h-4 w-4 shrink-0 text-fg-faint transition-colors group-hover:text-accent-text" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Figure label="Time" value={formatLength(workout.durationMin ?? 0)} />
        <Figure label="Volume" value={formatLoad(tonnes * 1000, unit)} />
        <Figure label="Sets" value={String(sets)} />
      </div>

      {shown.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-3.5">
          {shown.map((group) => (
            <p
              key={group.id}
              className="flex items-baseline gap-2 text-[12.5px] text-fg-muted"
            >
              <span className="tabular shrink-0 text-fg-dim">
                {group.workingSets} set{group.workingSets === 1 ? "" : "s"}
              </span>
              <span className="min-w-0 truncate">{group.name}</span>
            </p>
          ))}

          {hidden > 0 && (
            <p className="text-[12.5px] font-semibold text-accent-text">
              See {hidden} more exercise{hidden === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}

      {workout.status === "FAILED" && workout.error && (
        <p className="mt-3 text-[11.5px] text-clay-text">{workout.error}</p>
      )}
    </Link>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="mono-label">{label}</p>
      <p className="tabular mt-1 truncate text-[15px] font-extrabold leading-none text-fg">
        {value}
      </p>
    </div>
  );
}
