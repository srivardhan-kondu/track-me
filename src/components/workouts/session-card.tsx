import { ChevronDown } from "lucide-react";

import { AudioNote } from "@/components/timeline/audio-note";
import { CommentThread } from "@/components/timeline/comment-thread";
import { WorkoutActions } from "@/components/timeline/record-actions";
import { cn, tonnesLifted } from "@/lib/utils";
import type { TimelineWorkout } from "@/services/reporting";

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
  audioUrl,
  viewerId,
  isOwner,
  canComment,
  open = false,
}: {
  workout: TimelineWorkout;
  /** Mono meta line: when it happened. */
  when: string;
  audioUrl: string | null;
  viewerId: string;
  isOwner: boolean;
  canComment: boolean;
  /** The most recent session opens with its sets already showing. */
  open?: boolean;
}) {
  const title = workout.title ?? "Workout";
  const tonnes = tonnesLifted(workout.exercises);

  return (
    <details
      open={open}
      className={cn(
        "group rounded-[14px] border",
        open
          ? "border-line-strong bg-surface-raised"
          : "border-line bg-surface-muted",
      )}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3.5 p-4 marker:content-none">
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
            {workout.durationMin ? ` · ${workout.durationMin} min` : ""}
            {workout.exercises.length > 0
              ? ` · ${workout.exercises.length} exercises`
              : ""}
          </span>
        </span>

        {tonnes > 0 && (
          <span className="tabular shrink-0 font-mono text-[13.5px] text-fg">
            {tonnes.toFixed(1)} t
          </span>
        )}

        <ChevronDown className="h-4 w-4 shrink-0 text-fg-faint transition-transform group-open:rotate-180" />
      </summary>

      <div className="flex flex-col gap-3.5 border-t border-line px-4 pb-4 pt-3.5">
        {workout.exercises.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {workout.exercises.map((ex) => (
              <li
                key={ex.id}
                className="flex items-baseline gap-4 text-[12.5px] text-fg-muted"
              >
                <span className="min-w-0 flex-1 truncate">{ex.name}</span>
                <span className="tabular shrink-0 font-mono text-[11.5px] text-fg-dim">
                  {ex.weightKg !== null ? `${ex.weightKg} kg` : "BW"}
                  {ex.sets !== null && ex.reps !== null
                    ? ` · ${ex.sets} × ${ex.reps}`
                    : ex.sets !== null
                      ? ` · ${ex.sets} sets`
                      : ""}
                </span>
              </li>
            ))}
          </ul>
        )}

        {workout.notes && (
          <p className="text-[12.5px] leading-relaxed text-fg-dim">
            {workout.notes}
          </p>
        )}

        {audioUrl && <AudioNote src={audioUrl} />}

        {workout.transcript && (
          <p className="font-serif text-[13.5px] italic leading-relaxed text-fg-muted">
            &ldquo;{workout.transcript}&rdquo;
          </p>
        )}

        {workout.status === "FAILED" && workout.error && (
          <p className="text-[11.5px] text-clay-text">{workout.error}</p>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CommentThread
              viewerId={viewerId}
              canComment={canComment}
              target={{ workoutId: workout.id }}
              comments={workout.comments.map((c) => ({
                id: c.id,
                body: c.body,
                createdAt: c.createdAt.toISOString(),
                author: c.author,
              }))}
            />
          </div>

          {isOwner && <WorkoutActions workoutId={workout.id} />}
        </div>
      </div>
    </details>
  );
}
