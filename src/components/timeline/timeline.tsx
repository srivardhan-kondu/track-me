import {
  AlertTriangle,
  Dumbbell,
  Loader2,
  Scale,
  UtensilsCrossed,
} from "lucide-react";

import { CommentThread } from "@/components/timeline/comment-thread";
import { MacroRow, MacroSplitBar } from "@/components/timeline/macros";
import { MealActions } from "@/components/timeline/meal-actions";
import {
  WeightActions,
  WorkoutActions,
} from "@/components/timeline/record-actions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { mediaUrl } from "@/services/storage";
import type { TimelineEntry } from "@/services/reporting";

function timeLabel(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

const SLOT_LABEL: Record<string, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
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

function Rail({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <div className="flex flex-col items-center">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-1 w-px flex-1 bg-border" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PROCESSING" || status === "PENDING") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Analysing
      </Badge>
    );
  }
  if (status === "FAILED") {
    return (
      <Badge variant="destructive" className="gap-1">
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
  isOwner,
  canComment,
  emptyState,
}: {
  entries: TimelineEntry[];
  viewerId: string;
  isOwner: boolean;
  canComment: boolean;
  emptyState?: React.ReactNode;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        {emptyState ?? (
          <p className="text-sm text-muted-foreground">
            Nothing logged yet today.
          </p>
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
        return { entry, imageUrl: await mediaUrl(entry.data.photoKey), audioUrl: null };
      }
      return {
        entry,
        imageUrl: null,
        audioUrl: await mediaUrl(entry.data.audioKey),
      };
    }),
  );

  return (
    <ol className="space-y-1">
      {resolved.map(({ entry, imageUrl, audioUrl }, index) => {
        const last = index === resolved.length - 1;

        return (
          <li key={`${entry.kind}-${entry.id}`} className="flex gap-3">
            <div className={cn("flex flex-col items-center", last && "pb-2")}>
              <Rail
                icon={
                  entry.kind === "meal"
                    ? UtensilsCrossed
                    : entry.kind === "workout"
                      ? Dumbbell
                      : Scale
                }
              />
            </div>

            <div className="min-w-0 flex-1 pb-5">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="tabular text-xs font-medium text-muted-foreground">
                  {entry.kind === "weight"
                    ? "Morning"
                    : timeLabel(entry.at)}
                </span>
                {entry.kind !== "weight" && (
                  <StatusBadge status={entry.data.status} />
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
                {entry.kind === "meal" && (
                  <MealBody
                    meal={entry.data}
                    imageUrl={imageUrl}
                    audioUrl={audioUrl}
                    isOwner={isOwner}
                  />
                )}

                {entry.kind === "workout" && (
                  <WorkoutBody
                    workout={entry.data}
                    audioUrl={audioUrl}
                    isOwner={isOwner}
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
}: {
  meal: Extract<TimelineEntry, { kind: "meal" }>["data"];
  imageUrl: string | null;
  audioUrl: string | null;
  isOwner: boolean;
}) {
  const items = readItems(meal.items);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={meal.title ?? "Meal"}
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-semibold leading-tight">
                {meal.title ?? "Logged meal"}
              </h3>
              {meal.slot && (
                <span className="text-xs text-muted-foreground">
                  {SLOT_LABEL[meal.slot] ?? meal.slot}
                </span>
              )}
            </div>
            {isOwner && <MealActions meal={meal} />}
          </div>

          <MacroRow macros={meal} className="mt-2" />
        </div>
      </div>

      <MacroSplitBar macros={meal} />

      {meal.transcript && (
        <p className="text-sm italic leading-relaxed text-muted-foreground">
          &ldquo;{meal.transcript}&rdquo;
        </p>
      )}

      {items.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            {items.length} ingredient{items.length === 1 ? "" : "s"}
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-1 text-left font-medium">Item</th>
                  <th className="py-1 text-right font-medium">kcal</th>
                  <th className="py-1 text-right font-medium">P</th>
                  <th className="py-1 text-right font-medium">C</th>
                  <th className="py-1 text-right font-medium">F</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-1 pr-2">
                      {item.name}
                      <span className="ml-1 text-muted-foreground">
                        {item.quantity}
                      </span>
                    </td>
                    <td className="py-1 text-right">{Math.round(item.calories)}</td>
                    <td className="py-1 text-right">{Math.round(item.protein)}</td>
                    <td className="py-1 text-right">{Math.round(item.carbs)}</td>
                    <td className="py-1 text-right">{Math.round(item.fat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {audioUrl && (
        <audio controls src={audioUrl} className="h-8 w-full max-w-xs" />
      )}

      {meal.status === "FAILED" && meal.error && (
        <p className="text-xs text-destructive">{meal.error}</p>
      )}
    </div>
  );
}

function WorkoutBody({
  workout,
  audioUrl,
  isOwner,
}: {
  workout: Extract<TimelineEntry, { kind: "workout" }>["data"];
  audioUrl: string | null;
  isOwner: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold leading-tight">
            {workout.title ?? "Workout"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {workout.exercises.length} exercise
            {workout.exercises.length === 1 ? "" : "s"}
            {workout.durationMin ? ` · ${workout.durationMin} min` : ""}
          </p>
        </div>
        {isOwner && <WorkoutActions workoutId={workout.id} />}
      </div>

      {workout.exercises.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="tabular">
              {workout.exercises.map((ex) => (
                <tr key={ex.id} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 pr-2 font-medium">{ex.name}</td>
                  <td className="py-1.5 text-right text-muted-foreground">
                    {ex.weightKg !== null ? `${ex.weightKg} kg` : "BW"}
                  </td>
                  <td className="w-20 py-1.5 text-right text-muted-foreground">
                    {ex.sets !== null && ex.reps !== null
                      ? `${ex.sets} × ${ex.reps}`
                      : ex.sets !== null
                        ? `${ex.sets} sets`
                        : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {workout.notes && (
        <p className="text-sm text-muted-foreground">{workout.notes}</p>
      )}

      {workout.transcript && (
        <p className="text-sm italic leading-relaxed text-muted-foreground">
          &ldquo;{workout.transcript}&rdquo;
        </p>
      )}

      {audioUrl && (
        <audio controls src={audioUrl} className="h-8 w-full max-w-xs" />
      )}

      {workout.status === "FAILED" && workout.error && (
        <p className="text-xs text-destructive">{workout.error}</p>
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
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Check-in"
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold leading-tight">Weigh-in</h3>
              <p className="tabular mt-0.5 text-lg font-semibold">
                {entry.weightKg}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  kg
                </span>
              </p>
            </div>
            {isOwner && <WeightActions entryId={entry.id} />}
          </div>

          {entry.notes && (
            <p className="mt-1 text-sm text-muted-foreground">{entry.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}
