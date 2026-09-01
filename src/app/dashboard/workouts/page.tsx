import Link from "next/link";
import { ChevronRight, Mic, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { VolumeBars, type VolumeBar } from "@/components/charts/volume-bars";
import { MuscleMap } from "@/components/charts/muscle-map";
import { VolumeBreakdown } from "@/components/exercises/volume-breakdown";
import { EmptyState, SectionHeading } from "@/components/layout/page";
import { WorkoutForm } from "@/components/log/workout-form";
import { ProcessingWatcher } from "@/components/timeline/processing-watcher";
import { SessionCard } from "@/components/workouts/session-card";
import { StatCard } from "@/components/ui/metric";
import { db } from "@/lib/db";
import { PremiumNotice } from "@/components/billing/premium-notice";
import { historyDays } from "@/lib/entitlements";
import { premiumStatus, requireUser } from "@/lib/session";
import {
  addDaysInZone,
  formatDateInZone,
  isSameDayInZone,
  safeZone,
  startOfDayInZone,
} from "@/lib/tz";
import { formatTonnage } from "@/lib/units";
import { tonnesLifted } from "@/lib/utils";
import { getMuscleVolume } from "@/services/exercises/volume";
import { getUnits } from "@/services/units";
import { exerciseInclude, type TimelineWorkout } from "@/services/reporting";
import { StartWorkout } from "@/components/workouts/start-workout";

export const metadata = { title: "Workouts" };
// Meal and workout logging run transcription and analysis in after(), which
// counts toward this function's duration. 60s is the Vercel Hobby ceiling.
export const maxDuration = 60;

const WEEKS = 5;
const DAYS = WEEKS * 7;

export default async function WorkoutsPage() {
  const user = await requireUser();

  const { premium } = await premiumStatus(user.id);

  const zone = safeZone(user.timeZone);
  // Sessions older than the window stay in the database untouched; the free
  // plan simply does not read that far back.
  const days = historyDays(premium, DAYS);
  const from = startOfDayInZone(addDaysInZone(new Date(), -(days - 1), zone), zone);

  const [workouts, pending, volume, units, draft] = await Promise.all([
    db.workout.findMany({
      where: { userId: user.id, performedAt: { gte: from } },
      orderBy: { performedAt: "desc" },
      include: {
        exercises: exerciseInclude,
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, name: true, image: true } },
          },
        },
      },
    }),
    db.workout.count({
      where: { userId: user.id, status: { in: ["PENDING", "PROCESSING"] } },
    }),
    getMuscleVolume(user.id, 7, zone),
    getUnits(user.id),
    db.workoutDraft.findUnique({
      where: { userId: user.id },
      select: { startedAt: true },
    }),
  ]);

  const weeks = Math.max(1, Math.round(days / 7));

  const sessions = workouts.length;
  const totalMinutes = workouts.reduce((a, w) => a + (w.durationMin ?? 0), 0);
  const perWeek = Math.round((sessions / weeks) * 10) / 10;

  // Tonnage per week, oldest first, so the current week closes the chart.
  const weekTotals = new Array(weeks).fill(0);
  for (const w of workouts) {
    const offset = Math.floor(
      (w.performedAt.getTime() - from.getTime()) / 86_400_000,
    );
    const bucket = Math.min(weeks - 1, Math.max(0, Math.floor(offset / 7)));
    weekTotals[bucket] += tonnesLifted(w.exercises);
  }

  const bars: VolumeBar[] = weekTotals.map((value, i) => ({
    label: formatDateInZone(addDaysInZone(from, i * 7, zone), zone, {
      day: "numeric",
      month: "short",
    }),
    value: Math.round(value * 10) / 10,
  }));

  const thisWeek = bars[bars.length - 1].value;
  const best = Math.max(...bars.map((b) => b.value));

  // No presigned audio here any more: the cards no longer play the voice note,
  // so signing one URL per session on every page load bought nothing.
  const recent = workouts as unknown as TimelineWorkout[];

  return (
    <>
      <ProcessingWatcher initialPending={pending} />

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-serif text-[28px] leading-none text-fg sm:text-[30px]">
            Training
          </h1>
          <p className="mt-2.5 text-[13px] text-fg-dim">
            Last {premium ? `${weeks} weeks` : `${days} days`}
            {sessions > 0 && ` · ${perWeek} sessions a week`}
          </p>
        </div>

        {/*
          Two ways in, in the order they are wanted. Logging as you lift is
          the main event; dictating it afterwards is for the session you
          forgot to open the app for.

          While a session is running the button steps aside: the strip below
          says the same thing better, and two violet ways to resume stacked on
          top of each other is one too many.
        */}
        <div className="flex flex-wrap items-center gap-2.5">
          {!draft && <StartWorkout />}
          <WorkoutForm
            unit={units.weight}
            trigger={
              <Button variant="outline">
                <Mic className="h-4 w-4" />
                Log a past session
              </Button>
            }
          />
        </div>
      </div>

      {draft && (
        <Link
          href="/session"
          className="accent-gradient flex items-center gap-3.5 rounded-2xl border border-accent-line px-5 py-4 transition-colors hover:border-accent"
        >
          <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
            <Play className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-fg">
              Resume your workout
            </span>
            <span className="mt-0.5 block text-[12.5px] text-fg-dim">
              Started{" "}
              {formatDateInZone(draft.startedAt, zone, {
                hour: "numeric",
                minute: "2-digit",
              })}{" "}
              — pick up where you left off.
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-accent-text" />
        </Link>
      )}

      {!premium && (
        <PremiumNotice
          title="Showing the last 7 days"
          body="Every session you have logged is still recorded. Premium opens the full five-week view, strength progression and PR tracking."
        />
      )}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-line-strong bg-surface px-6 py-5">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[12.5px] font-semibold text-fg">Weekly volume</p>
            <p className="mono-label">
              {units.weight === "LB" ? "Pounds lifted" : "Tonnes lifted"}
            </p>
          </div>

          <VolumeBars
            className="mt-5"
            bars={bars}
            // The bars are scaled in tonnes either way; only the figures
            // spoken alongside them change unit.
            format={(t) => formatTonnage(t * 1000, units.weight)}
            caption={
              sessions === 0
                ? "Say what you lifted after your next session — sets, reps and weight get parsed automatically, and this chart starts filling in."
                : thisWeek >= best && thisWeek > 0
                  ? `Best week yet — ${formatTonnage(thisWeek * 1000, units.weight)} moved.`
                  : `${formatTonnage(thisWeek * 1000, units.weight)} this week, against a best of ${formatTonnage(best * 1000, units.weight)}.`
            }
          />
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard
            label="Sessions"
            value={sessions}
            note={premium ? `${weeks} weeks` : `${days} days`}
          />
          <StatCard
            label="Time trained"
            value={Math.round((totalMinutes / 60) * 10) / 10}
            unit="hours"
          />
        </div>
      </div>

      <section className="flex flex-col gap-3.5">
        <SectionHeading meta="Last 7 days">Volume by muscle group</SectionHeading>
        <div className="rounded-2xl border border-line-strong bg-surface p-5">
          <p className="mb-4 text-[12px] leading-relaxed text-fg-dim">
            A set counts fully toward the muscles an exercise trains directly,
            and half toward those assisting. The figure reads the same numbers —
            what it shows better than the list is what got nothing.
          </p>

          <div className="grid gap-7 lg:grid-cols-[280px_1fr] lg:items-start">
            <MuscleMap
              groups={volume.groups.map((g) => ({
                key: g.key,
                name: g.name,
                sets: g.sets,
              }))}
            />
            <VolumeBreakdown report={volume} days={7} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3.5">
        <SectionHeading>Recent sessions</SectionHeading>

        {recent.length === 0 ? (
          <EmptyState
            title="Nothing logged yet"
            body="Start a session and tick each set off as you do it — last time's weights sit beside today's, so the next number chooses itself. Or say what you lifted afterwards and Track Me works out the sets for you."
            action={
              <>
                <StartWorkout />
                <WorkoutForm
                  unit={units.weight}
                  trigger={
                    <Button variant="outline">
                      <Mic className="h-4 w-4" />
                      Log a past session
                    </Button>
                  }
                />
              </>
            }
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {recent.map((workout) => (
              <SessionCard
                key={workout.id}
                workout={workout}
                unit={units.weight}
                when={
                  isSameDayInZone(workout.performedAt, new Date(), zone)
                    ? `Today ${formatDateInZone(workout.performedAt, zone, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}`
                    : formatDateInZone(workout.performedAt, zone, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })
                }
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
