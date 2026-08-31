import { AlertTriangle, Loader2 } from "lucide-react";

import { AnalysisNote } from "@/components/billing/analysis-note";
import { AudioNote } from "@/components/timeline/audio-note";
import { CommentThread } from "@/components/timeline/comment-thread";
import { MacroRow, MacroSplitBar } from "@/components/timeline/macros";
import { MealActions } from "@/components/timeline/meal-actions";
import {
  WeightActions,
  WorkoutActions,
} from "@/components/timeline/record-actions";
import { Badge } from "@/components/ui/badge";
import { formatTimeInZone } from "@/lib/tz";
import { cn, round } from "@/lib/utils";
import { mediaUrl } from "@/services/storage";
import type { TimelineEntry } from "@/services/reporting";

const SLOT_LABEL: Record<string, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
};

/** Each kind gets its own dot colour, so a day reads by shape alone. */
const DOT: Record<TimelineEntry["kind"], string> = {
  meal: "bg-accent",
  workout: "bg-blue",
  weight: "bg-sage",
};

type MealItem = {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

function readItems(raw: unknown): MealItem[] {
  return Array.isArray(raw) ? (raw as MealItem[]) : [];
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PROCESSING" || status === "PENDING") {
    return (
      <Badge variant="secondary">
        <Loader2 className="h-3 w-3 animate-spin" />
        Analysing
      </Badge>
    );
  }
  if (status === "FAILED") {
    return (
      <Badge variant="destructive">
        <AlertTriangle className="h-3 w-3" />
        Failed
      </Badge>
    );
  }
  return null;
}

export async function Timeline({
  entries,
  viewerId,
  timeZone,
  isOwner,
  canComment,
  emptyState,
  upsell = false,
}: {
  entries: TimelineEntry[];
  viewerId: string;
  /** IANA zone the athlete logs in; times render in it, not the server's. */
  timeZone: string;
  isOwner: boolean;
  canComment: boolean;
  emptyState?: React.ReactNode;
  /** The viewer owns these entries and is on the free plan. */
  upsell?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10">
        {emptyState ?? (
          <p className="text-[13px] text-fg-dim">Nothing logged yet today.</p>
        )}
      </div>
    );
  }

  // Media URLs are signed server-side, so resolve them before render.
  const resolved = await Promise.all(
    entries.map(async (entry) => {
      if (entry.kind === "meal") {
        return {
          entry,
          imageUrl: await mediaUrl(entry.data.imageKey),
          audioUrl: await mediaUrl(entry.data.audioKey),
        };
      }
      if (entry.kind === "weight") {
        return {
          entry,
          imageUrl: await mediaUrl(entry.data.photoKey),
          audioUrl: null,
        };
      }
      return {
        entry,
        imageUrl: null,
        audioUrl: await mediaUrl(entry.data.audioKey),
      };
    }),
  );

  return (
    <ol className="flex flex-col">
      {resolved.map(({ entry, imageUrl, audioUrl }, index) => {
        const last = index === resolved.length - 1;
        const rich = entry.kind === "meal";

        return (
          <li key={`${entry.kind}-${entry.id}`} className="flex gap-3.5">
            <div className="w-[56px] shrink-0 pt-4 text-right">
              <span className="tabular font-mono text-[11px] text-fg-faint">
                {entry.kind === "weight"
                  ? "AM"
                  : formatTimeInZone(entry.at, timeZone)}
              </span>
            </div>

            <div
              className={cn(
                "relative w-px shrink-0",
                last
                  ? "bg-gradient-to-b from-line to-transparent"
                  : "bg-line",
              )}
              aria-hidden="true"
            >
              <span
                className={cn(
                  "absolute left-[-3px] top-[17px] h-[7px] w-[7px] rounded-full ring-4 ring-bg",
                  DOT[entry.kind],
                )}
              />
            </div>

            <div className={cn("min-w-0 flex-1", last ? "pb-1" : "pb-3.5")}>
              <div
                className={cn(
                  "rounded-[14px] border p-4",
                  rich
                    ? "border-line-strong bg-surface-raised"
                    : "border-line bg-surface-muted",
                )}
              >
                {entry.kind === "meal" && (
                  <MealBody
                    meal={entry.data}
                    imageUrl={imageUrl}
                    audioUrl={audioUrl}
                    isOwner={isOwner}
                    upsell={upsell}
                  />
                )}

                {entry.kind === "workout" && (
                  <WorkoutBody
                    workout={entry.data}
                    audioUrl={audioUrl}
                    isOwner={isOwner}
                    upsell={upsell}
                  />
                )}

                {entry.kind === "weight" && (
                  <WeightBody
                    entry={entry.data}
                    imageUrl={imageUrl}
                    isOwner={isOwner}
                  />
                )}

                <CommentThread
                  viewerId={viewerId}
                  canComment={canComment}
                  target={
                    entry.kind === "meal"
                      ? { mealId: entry.id }
                      : entry.kind === "workout"
                        ? { workoutId: entry.id }
                        : { weightEntryId: entry.id }
                  }
                  comments={entry.data.comments.map((c) => ({
                    id: c.id,
                    body: c.body,
                    createdAt: c.createdAt.toISOString(),
                    author: c.author,
                  }))}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function MealBody({
  meal,
  imageUrl,
  audioUrl,
  isOwner,
  upsell,
}: {
  meal: Extract<TimelineEntry, { kind: "meal" }>["data"];
  imageUrl: string | null;
  audioUrl: string | null;
  isOwner: boolean;
  upsell: boolean;
}) {
  const items = readItems(meal.items);
  const complete = meal.status === "COMPLETE";

  // A voice note that was never sent for transcription is not a failed
  // analysis, and must not be reported as one.
  const untranscribed =
    complete && !meal.aiGenerated && Boolean(meal.audioKey) && !meal.transcript;

  // Analysis finished but found nothing recognisable — an unclear photo, or a
  // voice note that picked up no speech. Say so rather than showing zeros.
  const foundNothing =
    complete && items.length === 0 && !meal.calories && !untranscribed;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-start gap-3.5">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={meal.title ?? "Meal"}
            className="h-[52px] w-[52px] shrink-0 rounded-[11px] object-cover"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[14.5px] font-semibold leading-tight tracking-[-0.005em] text-fg">
                {meal.title ?? "Logged meal"}
              </h3>
              <p className="mt-1 flex items-center gap-2 text-[11.5px] text-fg-dim">
                {meal.slot && <span>{SLOT_LABEL[meal.slot] ?? meal.slot}</span>}
                {meal.slot && items.length > 0 && <span>·</span>}
                {items.length > 0 && (
                  <span>
                    {items.length} ingredient{items.length === 1 ? "" : "s"}
                  </span>
                )}
                <StatusBadge status={meal.status} />
              </p>
            </div>

            <div className="flex shrink-0 items-start gap-1">
              {!foundNothing && (
                <span className="tabular font-mono text-[13px] text-fg">
                  {round(meal.calories) ?? "—"} kcal
                </span>
              )}
              {isOwner && <MealActions meal={meal} />}
            </div>
          </div>
        </div>
      </div>

      {!foundNothing && (
        <div className="flex flex-col gap-2.5">
          <MacroSplitBar macros={meal} />
          <MacroRow macros={meal} />
        </div>
      )}

      {foundNothing && (
        <div className="rounded-[11px] border border-dashed border-line-strong p-3.5">
          <p className="text-[13px] font-semibold text-fg">
            Nothing recognisable in this one
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-fg-dim">
            The photo may not show food, or the voice note may not have picked
            up any speech.{" "}
            {isOwner
              ? "Correct the macros by hand from the menu, or re-run the estimate."
              : "The athlete can correct this from their own timeline."}
          </p>
        </div>
      )}

      <AnalysisNote
        kind="meal"
        analysed={meal.aiGenerated}
        complete={complete}
        hasAudio={Boolean(meal.audioKey)}
        hasTranscript={Boolean(meal.transcript)}
        upsell={upsell && isOwner}
      />

      {audioUrl && <AudioNote src={audioUrl} />}

      {meal.transcript && (
        <p className="font-serif text-[13.5px] italic leading-relaxed text-fg-muted">
          &ldquo;{meal.transcript}&rdquo;
        </p>
      )}

      {items.length > 0 && (
        <details className="group">
          <summary className="mono-label cursor-pointer list-none transition-colors marker:content-none hover:text-fg">
            Per ingredient
          </summary>

          <div className="mt-2.5 overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="mono-label py-1.5 text-left">Item</th>
                  <th className="mono-label py-1.5 text-right">kcal</th>
                  <th className="mono-label py-1.5 text-right">P</th>
                  <th className="mono-label py-1.5 text-right">C</th>
                  <th className="mono-label py-1.5 text-right">F</th>
                </tr>
              </thead>
              <tbody className="tabular text-fg-muted">
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-line/60 last:border-0">
                    <td className="py-1.5 pr-3">
                      {item.name}
                      <span className="ml-1.5 text-fg-faint">
                        {item.quantity}
                      </span>
                    </td>
                    <td className="py-1.5 text-right">
                      {Math.round(item.calories)}
                    </td>
                    <td className="py-1.5 text-right">
                      {Math.round(item.protein)}
                    </td>
                    <td className="py-1.5 text-right">
                      {Math.round(item.carbs)}
                    </td>
                    <td className="py-1.5 text-right">
                      {Math.round(item.fat)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {meal.status === "FAILED" && meal.error && (
        <p className="text-[11.5px] text-clay-text">{meal.error}</p>
      )}
    </div>
  );
}

function WorkoutBody({
  workout,
  audioUrl,
  isOwner,
  upsell,
}: {
  workout: Extract<TimelineEntry, { kind: "workout" }>["data"];
  audioUrl: string | null;
  isOwner: boolean;
  upsell: boolean;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[13.5px] font-semibold leading-tight text-fg">
            {workout.title ?? "Workout"}
          </h3>
          <p className="mt-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em] text-fg-dim">
            <span>
              {workout.exercises.length} exercise
              {workout.exercises.length === 1 ? "" : "s"}
            </span>
            {workout.durationMin ? <span>· {workout.durationMin} min</span> : null}
            <StatusBadge status={workout.status} />
          </p>
        </div>

        {isOwner && <WorkoutActions workoutId={workout.id} />}
      </div>

      {workout.exercises.length > 0 && (
        <ul className="flex flex-col gap-2 border-t border-line pt-3.5">
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

      <AnalysisNote
        kind="workout"
        analysed={workout.aiGenerated}
        complete={workout.status === "COMPLETE"}
        hasAudio={Boolean(workout.audioKey)}
        hasTranscript={Boolean(workout.transcript)}
        upsell={upsell && isOwner}
      />

      {audioUrl && <AudioNote src={audioUrl} />}

      {workout.transcript && (
        <p className="font-serif text-[13.5px] italic leading-relaxed text-fg-muted">
          &ldquo;{workout.transcript}&rdquo;
        </p>
      )}

      {workout.status === "FAILED" && workout.error && (
        <p className="text-[11.5px] text-clay-text">{workout.error}</p>
      )}
    </div>
  );
}

function WeightBody({
  entry,
  imageUrl,
  isOwner,
}: {
  entry: Extract<TimelineEntry, { kind: "weight" }>["data"];
  imageUrl: string | null;
  isOwner: boolean;
}) {
  return (
    <div className="flex items-start gap-3.5">
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="Check-in"
          className="h-[52px] w-[52px] shrink-0 rounded-[11px] object-cover"
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[13.5px] font-semibold leading-tight text-fg">
            Morning check-in
          </h3>

          <div className="flex shrink-0 items-center gap-1">
            <span className="tabular font-mono text-[12.5px] text-sage-text">
              {entry.weightKg} kg
            </span>
            {isOwner && <WeightActions entryId={entry.id} />}
          </div>
        </div>

        {entry.notes && (
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-dim">
            {entry.notes}
          </p>
        )}
      </div>
    </div>
  );
}
