import Link from "next/link";
import { notFound } from "next/navigation";

import { MuscleMap } from "@/components/charts/muscle-map";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { groupExercises } from "@/lib/exercise-groups";
import { formatLength } from "@/lib/live-session";
import { requireUser } from "@/lib/session";
import {
  addDaysInZone,
  formatDateInZone,
  safeZone,
  startOfDayInZone,
  toDateParam,
} from "@/lib/tz";
import { displayWeight, formatLoad, weightLabel } from "@/lib/units";
import { tonnesLifted } from "@/lib/utils";
import { getWorkoutMuscleVolume } from "@/services/exercises/volume";
import { exerciseInclude } from "@/services/reporting";
import { getUnits } from "@/services/units";

export const metadata = { title: "Workout complete" };

/** 1st, 2nd, 3rd, 4th — and 11th, 12th, 13th, which the naive rule gets wrong. */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/**
 * The screen that comes up the moment a session is saved.
 *
 * It exists to be the payoff. An athlete has just spent an hour and pressed a
 * button, and what they want in that second is not a table — it is to be told
 * the work landed, where it landed, and that the week is still on track. The
 * numbers underneath are for the athlete who does want the table.
 */
export default async function SessionDonePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const zone = safeZone(user.timeZone);

  const workout = await db.workout.findUnique({
    where: { id },
    include: { exercises: exerciseInclude },
  });

  if (!workout || workout.userId !== user.id) notFound();

  const weekFrom = startOfDayInZone(addDaysInZone(new Date(), -6, zone), zone);

  const [units, volume, total, week] = await Promise.all([
    getUnits(user.id),
    getWorkoutMuscleVolume(workout.id),
    db.workout.count({ where: { userId: user.id, status: "COMPLETE" } }),
    db.workout.findMany({
      where: {
        userId: user.id,
        status: "COMPLETE",
        performedAt: { gte: weekFrom },
      },
      select: { performedAt: true },
    }),
  ]);

  const trained = new Set(week.map((w) => toDateParam(w.performedAt, zone)));
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDaysInZone(weekFrom, i, zone);
    return {
      key: toDateParam(day, zone),
      letter: formatDateInZone(day, zone, { weekday: "short" }).charAt(0),
      trained: trained.has(toDateParam(day, zone)),
    };
  });

  const tonnes = tonnesLifted(workout.exercises);
  const groups = groupExercises(workout.exercises);
  const sets = groups.reduce((a, g) => a + g.workingSets, 0);

  return (
    <div className="safe-t safe-b flex min-h-dvh flex-col px-[max(1.25rem,env(safe-area-inset-left,0px))] pb-6 pt-10">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <header className="text-center">
          <h1 className="font-serif text-[30px] leading-none text-fg">
            Nice work!
          </h1>
          <p className="mt-3 text-[14px] text-fg-muted">
            This is your {ordinal(total)} workout
          </p>
        </header>

        <div className="accent-gradient mt-7 rounded-2xl border border-accent-line p-6">
          <MuscleMap
            groups={volume.groups.map((g) => ({
              key: g.key,
              name: g.name,
              sets: g.sets,
            }))}
          />

          <div className="mt-6 grid grid-cols-7 gap-1.5">
            {days.map((day) => (
              <div key={day.key} className="flex flex-col items-center gap-2">
                <span className="mono-label">{day.letter}</span>
                <span
                  className={
                    day.trained
                      ? "h-7 w-7 rounded-full bg-accent"
                      : "h-7 w-7 rounded-full bg-track"
                  }
                />
              </div>
            ))}
          </div>

          <p className="mt-5 text-center text-[13px] text-fg-muted">
            You trained{" "}
            <span className="font-bold text-fg">{trained.size} time{trained.size === 1 ? "" : "s"}</span>{" "}
            in the last 7 days
          </p>
        </div>

        <div className="metric-strip mt-4">
          <Cell label="Duration" value={formatLength(workout.durationMin ?? 0)} />
          <Cell label="Volume" value={formatLoad(tonnes * 1000, units.weight)} />
          <Cell label="Sets" value={String(sets)} />
        </div>

        {groups.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2.5 rounded-2xl border border-line bg-surface px-5 py-4">
            {groups.map((group) => (
              <li key={group.id} className="flex items-baseline gap-4">
                <span className="min-w-0 flex-1 truncate text-[13px] text-fg-muted">
                  {group.name}
                </span>
                <span className="tabular shrink-0 text-[12px] text-fg-dim">
                  {group.workingSets} set{group.workingSets === 1 ? "" : "s"}
                  {group.topKg !== null &&
                    ` · top ${displayWeight(group.topKg, units.weight)} ${weightLabel(units.weight)}`}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto pt-8">
          <Button asChild size="lg" className="w-full">
            <Link href="/dashboard/workouts">Done</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <p className="mono-label">{label}</p>
      <p className="tabular mt-1.5 text-[18px] font-extrabold leading-none text-fg">
        {value}
      </p>
    </div>
  );
}
