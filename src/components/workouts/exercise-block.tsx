"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Timer,
  Trash2,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatClock,
  formatRest,
  REST_OPTIONS,
  SET_KINDS,
  SET_KIND_LABEL,
  SET_KIND_MARK,
  type DraftExercise,
  type DraftSet,
  type PreviousSet,
  type SetKind,
} from "@/lib/live-session";
import { displayWeight, weightLabel, type WeightUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

/**
 * One exercise, mid-session.
 *
 * The table is the whole design. Five columns, and the athlete's eye goes
 * left to right along a row exactly once: which set this is, what they did
 * last time, what they are doing now, and a tick. Everything else on the card
 * — the name, the note, the rest interval — sits above it and stays out of
 * the way, because between sets there are about four seconds of attention
 * available and they all belong to the row.
 */

/** Set kinds keep the one violet where they can; failure is the exception. */
const KIND_STYLE: Record<SetKind, string> = {
  WORKING: "text-fg",
  WARMUP: "text-blue-text",
  DROP: "text-accent-text",
  FAILURE: "text-clay-text",
};

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "EX";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** The number in the chip: warm-ups are lettered, working sets counted. */
function setMark(sets: DraftSet[], index: number): string {
  const kind = sets[index].kind;
  if (kind !== "WORKING") return SET_KIND_MARK[kind];
  let n = 0;
  for (let i = 0; i <= index; i++) if (sets[i].kind === "WORKING") n += 1;
  return String(n);
}

/** "50kg × 8", "0:45", or nothing where there is no history to show. */
function describePrevious(
  previous: PreviousSet[] | undefined,
  index: number,
  unit: WeightUnit,
): string | null {
  const set = previous?.[index];
  if (!set) return null;
  if (set.seconds) return formatClock(set.seconds);
  if (set.reps === null) return null;
  return set.weightKg === null
    ? `BW × ${set.reps}`
    : `${displayWeight(set.weightKg, unit)}${weightLabel(unit)} × ${set.reps}`;
}

export function ExerciseBlock({
  exercise,
  count,
  index,
  unit,
  previous,
  elapsedFor,
  onPatch,
  onPatchSet,
  onAddSet,
  onRemoveSet,
  onToggleSet,
  onToggleStopwatch,
  onRemove,
  onMove,
}: {
  exercise: DraftExercise;
  /** How many exercises are in the session, so the last one hides "move down". */
  count: number;
  index: number;
  unit: WeightUnit;
  /** Last session's sets for this movement, in order. */
  previous: PreviousSet[] | undefined;
  /** Seconds on a timed set's face, counting if it is running. */
  elapsedFor: (set: DraftSet) => number;
  onPatch: (patch: Partial<DraftExercise>) => void;
  onPatchSet: (setId: string, patch: Partial<DraftSet>) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onToggleSet: (setId: string) => void;
  onToggleStopwatch: (setId: string) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const timed = exercise.mode === "TIME";
  const label = weightLabel(unit).toUpperCase();

  const columns = timed
    ? "grid-cols-[38px_minmax(0,1fr)_124px_38px]"
    : "grid-cols-[38px_minmax(0,1fr)_66px_58px_38px]";

  return (
    <section className="border-b border-line px-[max(1rem,env(safe-area-inset-left,0px))] py-5 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-bold text-accent-text">
          {initials(exercise.name)}
        </span>

        <p className="min-w-0 flex-1 truncate text-[15px] font-bold text-accent-text">
          {exercise.name}
        </p>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Options for ${exercise.name}`}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-fg-faint transition-colors hover:bg-hover hover:text-fg"
            >
              <MoreVertical className="h-[18px] w-[18px]" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{exercise.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={() => onPatch({ mode: timed ? "REPS" : "TIME" })}
            >
              {timed ? "Track weight & reps" : "Track time held"}
            </DropdownMenuItem>

            {index > 0 && (
              <DropdownMenuItem onSelect={() => onMove(-1)}>
                <ChevronUp className="h-4 w-4" />
                Move up
              </DropdownMenuItem>
            )}
            {index < count - 1 && (
              <DropdownMenuItem onSelect={() => onMove(1)}>
                <ChevronDown className="h-4 w-4" />
                Move down
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onRemove} className="text-clay-text">
              <Trash2 className="h-4 w-4" />
              Remove exercise
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <input
        value={exercise.notes}
        onChange={(e) => onPatch({ notes: e.target.value })}
        placeholder="Add notes here…"
        aria-label={`Notes for ${exercise.name}`}
        className="mt-3.5 w-full bg-transparent text-[13.5px] text-fg outline-none placeholder:text-fg-faint"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "mt-3 flex items-center gap-2 rounded-[10px] py-1 text-[13px] font-semibold transition-colors",
              exercise.rest > 0 ? "text-accent-text" : "text-fg-dim hover:text-fg",
            )}
          >
            <Timer className="h-4 w-4" />
            Rest Timer: {exercise.rest > 0 ? formatRest(exercise.rest) : "OFF"}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Rest between sets</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {REST_OPTIONS.map((seconds) => (
            <DropdownMenuItem
              key={seconds}
              onSelect={() => onPatch({ rest: seconds })}
            >
              <Check
                className={cn(
                  "h-3.5 w-3.5",
                  exercise.rest === seconds ? "opacity-100" : "opacity-0",
                )}
              />
              {formatRest(seconds)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mt-4">
        <div
          className={cn(
            "mono-label grid items-center gap-1.5 px-0.5 pb-2",
            columns,
          )}
        >
          <span className="text-center">Set</span>
          <span className="pl-1">Previous</span>
          {timed ? (
            <span className="text-center">Time</span>
          ) : (
            <>
              <span className="text-center">{label}</span>
              <span className="text-center">Reps</span>
            </>
          )}
          <span className="grid place-items-center">
            <Check className="h-3.5 w-3.5" />
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {exercise.sets.map((set, i) => {
            const last = describePrevious(previous, i, unit);
            const seconds = elapsedFor(set);

            return (
              <div
                key={set.id}
                className={cn(
                  "grid items-center gap-1.5 rounded-[12px] py-0.5 transition-colors",
                  columns,
                  set.done && "bg-accent-soft",
                )}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Set ${i + 1} — ${SET_KIND_LABEL[set.kind]}`}
                      className={cn(
                        "tabular grid h-10 w-[38px] place-items-center rounded-[10px] bg-surface-inset text-[13.5px] font-bold transition-colors hover:bg-hover",
                        KIND_STYLE[set.kind],
                      )}
                    >
                      {setMark(exercise.sets, i)}
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Set type</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {SET_KINDS.map((kind) => (
                      <DropdownMenuItem
                        key={kind}
                        onSelect={() => onPatchSet(set.id, { kind })}
                      >
                        <Check
                          className={cn(
                            "h-3.5 w-3.5",
                            set.kind === kind ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {SET_KIND_LABEL[kind]}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => onRemoveSet(set.id)}
                      className="text-clay-text"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove set
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/*
                  Tapping last session's figures copies them into the row. It
                  is the most common thing an athlete wants — repeat it, then
                  adjust — and it turns four taps into one.
                */}
                <button
                  type="button"
                  disabled={!last}
                  onClick={() => {
                    const before = previous?.[i];
                    if (!before) return;
                    onPatchSet(set.id, {
                      weight:
                        before.weightKg === null
                          ? ""
                          : String(displayWeight(before.weightKg, unit)),
                      reps: before.reps === null ? "" : String(before.reps),
                      seconds: before.seconds ?? 0,
                    });
                  }}
                  className="tabular truncate rounded-[8px] px-1 py-2 text-left text-[13px] text-fg-dim transition-colors enabled:hover:text-fg disabled:cursor-default"
                >
                  {last ?? "—"}
                </button>

                {timed ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onToggleStopwatch(set.id)}
                      aria-label="Start or pause this set"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-accent-line text-accent-text transition-colors hover:bg-accent-soft"
                    >
                      {set.runningSince ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                    <span
                      className={cn(
                        "tabular grid h-10 flex-1 place-items-center rounded-[10px] bg-surface-inset text-[14px] font-semibold",
                        seconds > 0 ? "text-accent-text" : "text-fg-faint",
                      )}
                    >
                      {formatClock(seconds)}
                    </span>
                  </div>
                ) : (
                  <>
                    <input
                      inputMode="decimal"
                      value={set.weight}
                      onChange={(e) =>
                        onPatchSet(set.id, {
                          weight: e.target.value.replace(/[^\d.]/g, ""),
                        })
                      }
                      placeholder={
                        previous?.[i]?.weightKg != null
                          ? String(displayWeight(previous[i].weightKg!, unit))
                          : "—"
                      }
                      aria-label={`Set ${i + 1} weight in ${weightLabel(unit)}`}
                      className="tabular h-10 w-full rounded-[10px] bg-surface-inset text-center text-[14px] font-semibold text-fg outline-none transition-colors focus:ring-1 focus:ring-accent placeholder:font-normal placeholder:text-fg-faint"
                    />
                    <input
                      inputMode="numeric"
                      value={set.reps}
                      onChange={(e) =>
                        onPatchSet(set.id, {
                          reps: e.target.value.replace(/\D/g, ""),
                        })
                      }
                      placeholder={
                        previous?.[i]?.reps != null ? String(previous[i].reps) : "—"
                      }
                      aria-label={`Set ${i + 1} reps`}
                      className="tabular h-10 w-full rounded-[10px] bg-surface-inset text-center text-[14px] font-semibold text-fg outline-none transition-colors focus:ring-1 focus:ring-accent placeholder:font-normal placeholder:text-fg-faint"
                    />
                  </>
                )}

                <button
                  type="button"
                  onClick={() => onToggleSet(set.id)}
                  aria-pressed={set.done}
                  aria-label={`Mark set ${i + 1} ${set.done ? "not done" : "done"}`}
                  className={cn(
                    "grid h-10 w-[38px] place-items-center rounded-[10px] transition-colors",
                    set.done
                      ? "bg-accent text-accent-ink"
                      : "bg-surface-inset text-fg-faint hover:bg-hover hover:text-fg-muted",
                  )}
                >
                  <Check className="h-[18px] w-[18px]" strokeWidth={3} />
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onAddSet}
          className="mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-surface-inset text-[13.5px] font-semibold text-fg-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <Plus className="h-4 w-4" />
          Add Set
        </button>
      </div>
    </section>
  );
}
