import { formatClock } from "@/lib/live-session";
import { displayWeight, weightLabel, type WeightUnit } from "@/lib/units";
import { cn } from "@/lib/utils";
import type { ExerciseGroup } from "@/lib/exercise-groups";

/**
 * One movement, read back set by set.
 *
 * The live logger's table is built for thumbs mid-session; this one is built
 * for reading afterwards, so it drops the inputs and the ticks and keeps only
 * what was done. Rows alternate their fill because a column of "25 kg x 15"
 * three times over is genuinely hard to keep your place in otherwise.
 */

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "EX";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function SetTable({
  group,
  unit,
}: {
  group: ExerciseGroup;
  unit: WeightUnit;
}) {
  // A movement held rather than repeated gets a duration column instead.
  const timed = group.sets.every((s) => s.seconds !== null);

  return (
    <section>
      <div className="flex items-center gap-3">
        <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-bold text-accent-text">
          {initials(group.name)}
        </span>
        <h3 className="min-w-0 flex-1 truncate text-[15px] font-bold text-accent-text">
          {group.name}
        </h3>
      </div>

      <div className="mt-3.5">
        <div className="mono-label grid grid-cols-[52px_minmax(0,1fr)] items-center px-3 pb-1.5">
          <span>Set</span>
          <span>{timed ? "Duration" : `Weight & reps`}</span>
        </div>

        <ol className="overflow-hidden rounded-[10px]">
          {group.sets.map((set, i) => (
            <li
              key={set.id}
              className={cn(
                "grid grid-cols-[52px_minmax(0,1fr)] items-center px-3 py-2.5",
                // Every other row, so the eye can hold a line across.
                i % 2 === 1 && "bg-surface-inset",
              )}
            >
              <span
                className={cn(
                  "tabular text-[13.5px] font-semibold",
                  set.kind === "WARMUP" ? "text-fg-faint" : "text-fg",
                )}
              >
                {set.kind === "WARMUP" ? "W" : countUpTo(group, i)}
              </span>

              <span className="tabular text-[13.5px] text-fg-muted">
                {describe(set, unit)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Working sets are numbered 1, 2, 3 — warm-ups sit outside the count. */
function countUpTo(group: ExerciseGroup, index: number): number {
  let n = 0;
  for (let i = 0; i <= index; i++) {
    if (group.sets[i].kind !== "WARMUP") n += 1;
  }
  return n;
}

function describe(
  set: { weightKg: number | null; reps: number | null; seconds: number | null },
  unit: WeightUnit,
): string {
  if (set.seconds !== null) return formatClock(set.seconds);

  const load =
    set.weightKg === null
      ? "Bodyweight"
      : `${displayWeight(set.weightKg, unit)} ${weightLabel(unit)}`;

  return set.reps === null ? load : `${load} × ${set.reps}`;
}
