import { WorkoutForm } from "@/components/log/workout-form";
import { StatTile } from "@/components/timeline/macros";
import { ProcessingWatcher } from "@/components/timeline/processing-watcher";
import { Timeline } from "@/components/timeline/timeline";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  addDaysInZone,
  formatDateInZone,
  fromDateParam,
  safeZone,
  startOfDayInZone,
  toDateParam,
} from "@/lib/tz";
import type { TimelineEntry } from "@/services/reporting";

export const metadata = { title: "Workouts" };
// Meal and workout logging run transcription and analysis in after(), which
// counts toward this function's duration. 60s is the Vercel Hobby ceiling.
export const maxDuration = 60;

const DAYS = 30;

export default async function WorkoutsPage() {
  const user = await requireUser();

  const zone = safeZone(user.timeZone);
  const from = startOfDayInZone(addDaysInZone(new Date(), -(DAYS - 1), zone), zone);

  const [workouts, pending] = await Promise.all([
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
  ]);

  const sessions = workouts.length;
  const totalMinutes = workouts.reduce((a, w) => a + (w.durationMin ?? 0), 0);
  const totalSets = workouts.reduce(
    (a, w) => a + w.exercises.reduce((s, e) => s + (e.sets ?? 0), 0),
    0,
  );
  // Sessions per week over the window, so the number is comparable week to week.
  const perWeek = Math.round((sessions / DAYS) * 7 * 10) / 10;

  const groups = new Map<string, typeof workouts>();
  for (const w of workouts) {
    const key = toDateParam(w.performedAt, zone);
    const bucket = groups.get(key);
    if (bucket) bucket.push(w);
    else groups.set(key, [w]);
  }

  return (
    <div className="space-y-6">
      <ProcessingWatcher initialPending={pending} />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workouts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The last {DAYS} days of training.
          </p>
        </div>
        <WorkoutForm />
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Sessions" value={sessions} hint={`${DAYS} days`} />
        <StatTile label="Per week" value={perWeek} hint="average" />
        <StatTile label="Total sets" value={totalSets} />
        <StatTile
          label="Time trained"
          value={Math.round(totalMinutes / 60)}
          unit="h"
        />
      </section>

      {groups.size === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <p className="text-sm font-medium">No workouts logged yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            After your next session, say what you lifted.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([key, dayWorkouts]) => {
            const day = fromDateParam(key, zone);
            const entries: TimelineEntry[] = dayWorkouts.map((w) => ({
              kind: "workout" as const,
              at: w.performedAt,
              id: w.id,
              data: w as unknown as Extract<
                TimelineEntry,
                { kind: "workout" }
              >["data"],
            }));

            return (
              <section key={key}>
                <div className="mb-3 border-b border-border pb-2">
                  <h2 className="text-sm font-semibold">
                    {formatDateInZone(day, zone, {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                  </h2>
                </div>

                <Timeline
                  entries={entries}
                  viewerId={user.id}
                  timeZone={zone}
                  isOwner
                  canComment
                />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
