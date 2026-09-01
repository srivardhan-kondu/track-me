"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Loader2, Plus, Timer, X } from "lucide-react";
import { toast } from "sonner";

import {
  discardSession,
  finishSession,
  lookupPrevious,
  saveSession,
} from "@/app/actions/session";
import {
  ExercisePicker,
  type PickedExercise,
} from "@/components/exercises/exercise-picker";
import { ExerciseBlock } from "@/components/workouts/exercise-block";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  draftTotals,
  elapsedSeconds,
  formatClock,
  formatDuration,
  newExercise,
  newSet,
  movementKey,
  stopStopwatch,
  type DraftExercise,
  type DraftPayload,
  type DraftSet,
  type PreviousSet,
} from "@/lib/live-session";
import { runAction } from "@/lib/run-action";
import { formatLoad, type WeightUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

/**
 * A workout as it is happening.
 *
 * The screen is built around the thirty seconds between sets, which is the
 * only time anybody looks at it. So: the three figures that say how the
 * session is going are pinned to the top and never move, every exercise is
 * one tap-target-dense table, and the last thing a set needs is a tick that
 * is impossible to miss. Nothing here opens a dialog to record a number.
 *
 * The draft is saved to the server on a debounce and the elapsed clock is
 * computed from a start time, not accumulated — so the tab can be closed,
 * the phone can lock, and coming back resumes rather than restarts.
 */

/** Long enough not to fire on every keystroke, short enough to lose nothing. */
const SAVE_DEBOUNCE_MS = 700;

export function LiveSession({
  startedAt,
  initialPayload,
  initialPrevious,
  unit,
}: {
  /** ISO instant the session began, from the server's clock. */
  startedAt: string;
  initialPayload: DraftPayload;
  initialPrevious: Record<string, PreviousSet[]>;
  unit: WeightUnit;
}) {
  const router = useRouter();

  const [payload, setPayload] = React.useState(initialPayload);
  const [previous, setPrevious] = React.useState(initialPrevious);
  const [picking, setPicking] = React.useState(false);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [confirmFinish, setConfirmFinish] = React.useState(false);
  const [finishing, setFinishing] = React.useState(false);

  // One clock drives the elapsed time, every stopwatch and the rest timer.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const began = React.useMemo(() => new Date(startedAt).getTime(), [startedAt]);
  const elapsed = Math.max(0, Math.floor((now - began) / 1000));

  /* --- Rest between sets ------------------------------------------------ */

  const [restUntil, setRestUntil] = React.useState<number | null>(null);
  const restLeft = restUntil ? Math.ceil((restUntil - now) / 1000) : 0;

  React.useEffect(() => {
    if (restUntil && restUntil <= now) setRestUntil(null);
  }, [restUntil, now]);

  /* --- Autosave --------------------------------------------------------- */

  // Skips the first render: the payload on screen is the one just loaded, and
  // saving it back would be a write for nothing.
  const dirty = React.useRef(false);
  // Set once the draft is gone, so the flush below cannot bring it back.
  const closed = React.useRef(false);
  const latest = React.useRef(payload);
  latest.current = payload;

  React.useEffect(() => {
    if (!dirty.current) return;
    const id = setTimeout(() => {
      void saveSession(payload).catch(() => {
        /* The next keystroke retries; a dropped autosave is not worth a toast. */
      });
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [payload]);

  /*
    The debounce is cancelled when this screen goes away, which would quietly
    drop the last set somebody typed before tapping the chevron or closing the
    tab. So the pending save is forced through on the way out — but never once
    the draft has been finished or discarded, or the upsert would write the
    session straight back into existence.
  */
  React.useEffect(() => {
    const flush = () => {
      if (!dirty.current || closed.current) return;
      void saveSession(latest.current).catch(() => {});
    };

    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const edit = React.useCallback(
    (next: (current: DraftPayload) => DraftPayload) => {
      dirty.current = true;
      setPayload(next);
    },
    [],
  );

  /* --- Editing ---------------------------------------------------------- */

  const patchExercise = (id: string, patch: Partial<DraftExercise>) =>
    edit((p) => ({
      ...p,
      exercises: p.exercises.map((ex) => (ex.id === id ? { ...ex, ...patch } : ex)),
    }));

  const mapSets = (
    exerciseId: string,
    fn: (sets: DraftSet[]) => DraftSet[],
  ) =>
    edit((p) => ({
      ...p,
      exercises: p.exercises.map((ex) =>
        ex.id === exerciseId ? { ...ex, sets: fn(ex.sets) } : ex,
      ),
    }));

  function addExercise(picked: PickedExercise) {
    const exercise = newExercise(picked.name, picked.id);
    edit((p) => ({ ...p, exercises: [...p.exercises, exercise] }));
    setPicking(false);

    // Fetch last session's sets so the PREVIOUS column is filled before the
    // athlete has finished walking to the rack.
    void lookupPrevious([{ catalogId: picked.id, name: picked.name }])
      .then((found) => setPrevious((all) => ({ ...all, ...found })))
      .catch(() => {
        /* No history shown is a blank column, not an error worth reporting. */
      });
  }

  function addSet(exerciseId: string) {
    mapSets(exerciseId, (sets) => {
      // A new set starts on the last one's numbers, because that is nearly
      // always what it will be — same weight, same reps, or a nudge from there.
      const last = [...sets].reverse().find((s) => s.kind === "WORKING");
      return [
        ...sets,
        newSet(last ? { weight: last.weight, reps: last.reps } : undefined),
      ];
    });
  }

  function toggleSet(exercise: DraftExercise, setId: string) {
    const set = exercise.sets.find((s) => s.id === setId);
    if (!set) return;

    const completing = !set.done;

    mapSets(exercise.id, (sets) =>
      sets.map((s) =>
        s.id === setId
          ? // Ticking a running stopwatch stops it: the set is over.
            { ...stopStopwatch(s, Date.now()), done: completing }
          : s,
      ),
    );

    if (completing && exercise.rest > 0) {
      setRestUntil(Date.now() + exercise.rest * 1000);
    }
  }

  function toggleStopwatch(exerciseId: string, setId: string) {
    mapSets(exerciseId, (sets) =>
      sets.map((s) => {
        if (s.id !== setId) return s;
        return s.runningSince
          ? stopStopwatch(s, Date.now())
          : { ...s, runningSince: Date.now() };
      }),
    );
  }

  function moveExercise(id: string, direction: -1 | 1) {
    edit((p) => {
      const i = p.exercises.findIndex((ex) => ex.id === id);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= p.exercises.length) return p;
      const exercises = [...p.exercises];
      [exercises[i], exercises[j]] = [exercises[j], exercises[i]];
      return { ...p, exercises };
    });
  }

  /* --- Totals ----------------------------------------------------------- */

  const totals = React.useMemo(() => draftTotals(payload), [payload]);
  const unticked = totals.planned - totals.ticked;

  /* --- Finishing -------------------------------------------------------- */

  async function commit() {
    setFinishing(true);

    // Bank any stopwatch still running, so a held set is not saved at zero.
    const banked: DraftPayload = {
      ...payload,
      exercises: payload.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s) => stopStopwatch(s, Date.now())),
      })),
    };

    const res = await runAction(() => finishSession(banked));
    setFinishing(false);
    setConfirmFinish(false);

    if (!res.ok) return void toast.error(res.error);

    closed.current = true;
    router.replace(`/session/done/${res.id}`);
  }

  function finish() {
    if (totals.ticked === 0) {
      toast.error("Tick off at least one set, or discard the session.");
      return;
    }
    // Unticked rows are dropped on save, so say so before they vanish.
    if (unticked > 0) {
      setConfirmFinish(true);
      return;
    }
    void commit();
  }

  async function discard() {
    const res = await runAction(() => discardSession());
    if (!res.ok) return void toast.error(res.error);

    closed.current = true;
    router.replace("/dashboard/workouts");
  }

  /* --- The header's title swaps for the clock once the strip scrolls off -- */

  const stripRef = React.useRef<HTMLDivElement>(null);
  const [stripVisible, setStripVisible] = React.useState(true);

  React.useEffect(() => {
    const node = stripRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setStripVisible(entry.isIntersecting),
      { threshold: 0.6 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="safe-t sticky top-0 z-30 border-b border-line bg-bg/92 backdrop-blur-xl">
        <div className="flex min-h-[56px] items-center gap-2 px-[max(1rem,env(safe-area-inset-left,0px))]">
          {/*
            Down, not back: the session keeps running while the athlete goes
            and looks at something else, exactly as it does on a phone.
          */}
          <Link
            href="/dashboard/workouts"
            aria-label="Leave this session running and go back"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-strong text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <ChevronDown className="h-[18px] w-[18px]" />
          </Link>

          <p
            className={cn(
              "tabular min-w-0 flex-1 truncate text-[15px] font-bold transition-colors",
              stripVisible ? "text-fg" : "text-accent-text",
            )}
          >
            {stripVisible ? "Log Workout" : formatDuration(elapsed)}
          </p>

          {restLeft > 0 && (
            <span className="tabular flex shrink-0 items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-3 py-1.5 text-[12.5px] font-bold text-accent-text">
              <Timer className="h-3.5 w-3.5" />
              {formatClock(restLeft)}
              <button
                type="button"
                onClick={() => setRestUntil(null)}
                aria-label="Skip rest"
                className="-mr-1 grid h-5 w-5 place-items-center rounded-full hover:bg-hover"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          <Button size="sm" className="h-9 shrink-0 px-4" onClick={finish}>
            Finish
          </Button>
        </div>
      </header>

      <div
        ref={stripRef}
        className="grid grid-cols-3 gap-3 border-b border-line px-[max(1rem,env(safe-area-inset-left,0px))] py-4"
      >
        <Figure label="Duration" value={formatDuration(elapsed)} live />
        <Figure label="Volume" value={formatLoad(totals.volumeKg, unit)} />
        <Figure label="Sets" value={String(totals.sets)} />
      </div>

      <main className="flex-1 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
        {payload.exercises.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-serif text-[19px] text-fg">
              Nothing added yet
            </p>
            <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-fg-dim">
              Add your first movement and the sets you did last time appear
              beside it. The clock is already running.
            </p>
          </div>
        ) : (
          payload.exercises.map((exercise, i) => (
            <ExerciseBlock
              key={exercise.id}
              exercise={exercise}
              index={i}
              count={payload.exercises.length}
              unit={unit}
              previous={previous[movementKey(exercise.catalogId, exercise.name)]}
              elapsedFor={(set) => elapsedSeconds(set, now)}
              onPatch={(patch) => patchExercise(exercise.id, patch)}
              onPatchSet={(setId, patch) =>
                mapSets(exercise.id, (sets) =>
                  sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
                )
              }
              onAddSet={() => addSet(exercise.id)}
              onRemoveSet={(setId) =>
                mapSets(exercise.id, (sets) => sets.filter((s) => s.id !== setId))
              }
              onToggleSet={(setId) => toggleSet(exercise, setId)}
              onToggleStopwatch={(setId) => toggleStopwatch(exercise.id, setId)}
              onRemove={() =>
                edit((p) => ({
                  ...p,
                  exercises: p.exercises.filter((e) => e.id !== exercise.id),
                }))
              }
              onMove={(direction) => moveExercise(exercise.id, direction)}
            />
          ))
        )}

        <div className="flex flex-col gap-2.5 px-[max(1rem,env(safe-area-inset-left,0px))] pt-6">
          <Button size="lg" className="w-full" onClick={() => setPicking(true)}>
            <Plus className="h-[18px] w-[18px]" />
            Add Exercise
          </Button>

          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" size="lg" asChild>
              <Link href="/dashboard/settings">Settings</Link>
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="text-clay-text hover:bg-clay-soft"
              onClick={() => setConfirmDiscard(true)}
            >
              Discard Workout
            </Button>
          </div>
        </div>
      </main>

      <ExercisePicker
        open={picking}
        onOpenChange={setPicking}
        onPick={addExercise}
      />

      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Discard this workout?</DialogTitle>
            <DialogDescription>
              {totals.ticked > 0
                ? `${totals.ticked} completed set${totals.ticked === 1 ? "" : "s"} and everything else on screen will be thrown away. This cannot be undone.`
                : "Nothing has been logged yet, so nothing will be lost."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDiscard(false)}>
              Keep going
            </Button>
            <Button variant="destructive" onClick={discard}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmFinish} onOpenChange={setConfirmFinish}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Finish with sets left?</DialogTitle>
            <DialogDescription>
              {unticked} set{unticked === 1 ? " is" : "s are"} not ticked off.
              Only completed sets are saved — the rest are dropped, because a
              set you planned is not a set you did.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmFinish(false)}
              disabled={finishing}
            >
              Go back
            </Button>
            <Button onClick={commit} disabled={finishing}>
              {finishing && <Loader2 className="h-4 w-4 animate-spin" />}
              Finish workout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Figure({
  label,
  value,
  live = false,
}: {
  label: string;
  value: string;
  live?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="mono-label">{label}</p>
      <p
        className={cn(
          "tabular mt-1.5 truncate text-[19px] font-extrabold leading-none",
          live ? "text-accent-text" : "text-fg",
        )}
      >
        {value}
      </p>
    </div>
  );
}
