import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AudioNote } from "@/components/timeline/audio-note";
import { CommentThread } from "@/components/timeline/comment-thread";
import { WorkoutActions } from "@/components/timeline/record-actions";
import { MuscleSplit } from "@/components/workouts/muscle-split";
import { SetTable } from "@/components/workouts/set-table";
import { db } from "@/lib/db";
import { groupExercises } from "@/lib/exercise-groups";
import { formatLength } from "@/lib/live-session";
import { requireUser } from "@/lib/session";
import { formatDateInZone, safeZone } from "@/lib/tz";
import { formatLoad } from "@/lib/units";
import { tonnesLifted } from "@/lib/utils";
import { getWorkoutMuscleVolume } from "@/services/exercises/volume";
import { exerciseInclude } from "@/services/reporting";
import { mediaUrl } from "@/services/storage";
import { getUnits } from "@/services/units";

export const metadata = { title: "Workout" };

/**
 * One session, in full.
 *
 * The training page answers "how has it been going"; this answers "what
 * exactly did I do on Saturday". So everything the card deliberately leaves
 * out lives here — every set of every movement, what the session was for, the
 * voice note it came from, and the conversation with a coach about it.
 */
export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const zone = safeZone(user.timeZone);

  const workout = await db.workout.findUnique({
    where: { id },
    include: {
      exercises: exerciseInclude,
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, image: true } } },
      },
    },
  });

  if (!workout || workout.userId !== user.id) notFound();

  const [units, volume, audioUrl] = await Promise.all([
    getUnits(user.id),
    getWorkoutMuscleVolume(workout.id),
    mediaUrl(workout.audioKey),
  ]);

  const groups = groupExercises(workout.exercises);
  const sets = groups.reduce((a, g) => a + g.workingSets, 0);
  const tonnes = tonnesLifted(workout.exercises);

  return (
    <>
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/workouts"
          aria-label="Back to training"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-strong text-fg-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </Link>
        <p className="mono-label">Workout detail</p>
      </div>

      <header>
        <h1 className="font-serif text-[26px] leading-none text-fg sm:text-[30px]">
          {workout.title ?? "Workout"}
        </h1>
        <p className="mt-2.5 text-[13px] text-fg-dim">
          {formatDateInZone(workout.performedAt, zone, {
            weekday: "long",
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          {" · "}
          {formatDateInZone(workout.performedAt, zone, {
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </header>

      <div className="metric-strip">
        <Figure label="Time" value={formatLength(workout.durationMin ?? 0)} />
        <Figure label="Volume" value={formatLoad(tonnes * 1000, units.weight)} />
        <Figure label="Sets" value={String(sets)} />
      </div>

      {volume.groups.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface px-6 py-5">
          <MuscleSplit
            groups={volume.groups.map((g) => ({
              key: g.key,
              name: g.name,
              sets: g.sets,
            }))}
          />
        </div>
      )}

      {groups.length > 0 && (
        <section className="flex flex-col gap-7 rounded-2xl border border-line bg-surface px-5 py-6 sm:px-6">
          {groups.map((group) => (
            <SetTable key={group.id} group={group} unit={units.weight} />
          ))}
        </section>
      )}

      {(workout.notes || audioUrl || workout.transcript) && (
        <section className="flex flex-col gap-3.5 rounded-2xl border border-line bg-surface px-6 py-5">
          {workout.notes && (
            <p className="text-[13px] leading-relaxed text-fg-muted">
              {workout.notes}
            </p>
          )}

          {audioUrl && <AudioNote src={audioUrl} />}

          {workout.transcript && (
            <p className="font-serif text-[13.5px] italic leading-relaxed text-fg-muted">
              &ldquo;{workout.transcript}&rdquo;
            </p>
          )}
        </section>
      )}

      {workout.status === "FAILED" && workout.error && (
        <p className="text-[12.5px] text-clay-text">{workout.error}</p>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CommentThread
            viewerId={user.id}
            canComment
            target={{ workoutId: workout.id }}
            comments={workout.comments.map((c) => ({
              id: c.id,
              body: c.body,
              createdAt: c.createdAt.toISOString(),
              author: c.author,
            }))}
          />
        </div>

        <WorkoutActions workoutId={workout.id} />
      </div>
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <p className="mono-label">{label}</p>
      <p className="tabular mt-1.5 text-[19px] font-extrabold leading-none text-fg">
        {value}
      </p>
    </div>
  );
}
