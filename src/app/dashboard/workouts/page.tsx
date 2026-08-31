import { VolumeBars, type VolumeBar } from "@/components/charts/volume-bars";
import { VolumeBreakdown } from "@/components/exercises/volume-breakdown";
import { EmptyState, SectionHeading } from "@/components/layout/page";
import { WorkoutForm } from "@/components/log/workout-form";
import { ProcessingWatcher } from "@/components/timeline/processing-watcher";
import { SessionCard } from "@/components/workouts/session-card";
import { StatCard } from "@/components/ui/metric";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  addDaysInZone,
  formatDateInZone,
  isSameDayInZone,
  safeZone,
  startOfDayInZone,
} from "@/lib/tz";
import { tonnesLifted } from "@/lib/utils";
import { getMuscleVolume } from "@/services/exercises/volume";
import type { TimelineWorkout } from "@/services/reporting";
import { mediaUrl } from "@/services/storage";

export const metadata = { title: "Workouts" };
// Meal and workout logging run transcription and analysis in after(), which
// counts toward this function's duration. 60s is the Vercel Hobby ceiling.
export const maxDuration = 60;

const WEEKS = 5;
const DAYS = WEEKS * 7;

export default async function WorkoutsPage() {
  const user = await requireUser();

  const zone = safeZone(user.timeZone);
  const from = startOfDayInZone(
    addDaysInZone(new Date(), -(DAYS - 1), zone),
    zone,
  );

  const [workouts, pending, volume] = await Promise.all([
    db.workout.findMany({
      where: { userId: user.id, performedAt: { gte: from } },
      orderBy: { performedAt: "desc" },
      include: {
        exercises: { orderBy: { position: "asc" } },
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
  ]);

  const sessions = workouts.length;
  const totalMinutes = workouts.reduce((a, w) => a + (w.durationMin ?? 0), 0);
  const perWeek = Math.round((sessions / WEEKS) * 10) / 10;

  // Tonnage per week, oldest first, so the current week closes the chart.
  const weekTotals = new Array(WEEKS).fill(0);
  for (const w of workouts) {
    const offset = Math.floor(
      (w.performedAt.getTime() - from.getTime()) / 86_400_000,
    );
    const bucket = Math.min(WEEKS - 1, Math.max(0, Math.floor(offset / 7)));
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

  const resolved = await Promise.all(
    workouts.map(async (w) => ({
      workout: w as unknown as TimelineWorkout,
      audioUrl: await mediaUrl(w.audioKey),
    })),
  );

  return (
    <>
      <ProcessingWatcher initialPending={pending} />

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-serif text-[28px] leading-none text-fg sm:text-[30px]">
            Training
          </h1>
          <p className="mt-2.5 text-[13px] text-fg-dim">
            Last {WEEKS} weeks
            {sessions > 0 && ` · ${perWeek} sessions a week`}
          </p>
        </div>

        <WorkoutForm />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-line-strong bg-surface px-6 py-5">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[12.5px] font-semibold text-fg">Weekly volume</p>
            <p className="mono-label">Tonnes lifted</p>
          </div>

          <VolumeBars
            className="mt-5"
            bars={bars}
            caption={
              sessions === 0
                ? "Say what you lifted after your next session — sets, reps and weight get parsed automatically, and this chart starts filling in."
                : thisWeek >= best && thisWeek > 0
                  ? `Best week yet — ${thisWeek.toFixed(1)} t moved.`
                  : `${thisWeek.toFixed(1)} t this week, against a best of ${best.toFixed(1)} t.`
            }
          />
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard
            label="Sessions"
            value={sessions}
            note={`${WEEKS} weeks`}
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
            and half toward those assisting.
          </p>
          <VolumeBreakdown report={volume} days={7} />
        </div>
      </section>

      <section className="flex flex-col gap-3.5">
        <SectionHeading>Recent sessions</SectionHeading>

        {resolved.length === 0 ? (
          <EmptyState
            title="Nothing logged yet"
            body="After your next session, say what you lifted. Track Me works out the sets, the reps and the volume."
            action={<WorkoutForm />}
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {resolved.map(({ workout, audioUrl }, i) => (
              <SessionCard
                key={workout.id}
                workout={workout}
                audioUrl={audioUrl}
                open={i === 0}
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
                viewerId={user.id}
                isOwner
                canComment
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
