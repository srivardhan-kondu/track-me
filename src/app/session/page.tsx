import Link from "next/link";

import { StartWorkout } from "@/components/workouts/start-workout";
import { LiveSession } from "@/components/workouts/live-session";
import { db } from "@/lib/db";
import { readPayload } from "@/lib/live-session";
import { requireUser } from "@/lib/session";
import { lastPerformances } from "@/services/exercises/previous";
import { getUnits } from "@/services/units";

export const metadata = { title: "Workout" };

/**
 * The live logger, deliberately outside the dashboard frame.
 *
 * A session in progress takes the whole screen: no rail, no bottom bar, no
 * floating button for logging a meal. There is one thing to do here and the
 * only way out is Finish, Discard, or the chevron that leaves it running.
 */
export default async function SessionPage() {
  const user = await requireUser();

  const [draft, units] = await Promise.all([
    db.workoutDraft.findUnique({
      where: { userId: user.id },
      select: { startedAt: true, payload: true },
    }),
    getUnits(user.id),
  ]);

  if (!draft) {
    return (
      <div className="safe-t grid min-h-dvh place-items-center px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-serif text-[26px] leading-none text-fg">
            Start a workout
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-[13px] leading-relaxed text-fg-dim">
            The clock starts now. Add movements as you go, tick each set off as
            you finish it, and press Finish when you are done.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <StartWorkout size="lg" className="w-full" />
            <Link
              href="/dashboard/workouts"
              className="text-[12.5px] font-medium text-fg-dim transition-colors hover:text-fg"
            >
              Back to training
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const payload = readPayload(draft.payload, units.weight);

  const found = await lastPerformances(
    user.id,
    payload.exercises.map((ex) => ({ catalogId: ex.catalogId, name: ex.name })),
  );

  return (
    <LiveSession
      startedAt={draft.startedAt.toISOString()}
      initialPayload={payload}
      initialPrevious={Object.fromEntries(
        [...found].map(([key, entry]) => [key, entry.sets]),
      )}
      // The draft's own unit, not the profile's: an athlete who switched to
      // pounds mid-session must not have the sixty they already logged reread.
      unit={payload.unit}
    />
  );
}
