import { ChevronDown, Loader2 } from "lucide-react";

import { AnalysisNote, EstimateTag } from "@/components/billing/analysis-note";
import { AudioNote } from "@/components/timeline/audio-note";
import { CommentThread } from "@/components/timeline/comment-thread";
import { MacroSplitBar, MacroTicks } from "@/components/timeline/macros";
import { MealActions } from "@/components/timeline/meal-actions";
import { cn, round } from "@/lib/utils";
import type { TimelineMeal } from "@/services/reporting";

const SLOT_LABEL: Record<string, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
};

type MealItem = { name: string; quantity: string };

function readItems(raw: unknown): MealItem[] {
  return Array.isArray(raw) ? (raw as MealItem[]) : [];
}

/**
 * One meal as a scannable row: photo, what it was, how it split, what it cost.
 * Everything else — the recording, the transcript, the coach's note — opens
 * underneath rather than crowding the line.
 */
export function MealRow({
  meal,
  imageUrl,
  audioUrl,
  time,
  viewerId,
  isOwner,
  canComment,
  dim = false,
  upsell = false,
}: {
  meal: TimelineMeal;
  imageUrl: string | null;
  audioUrl: string | null;
  time: string;
  viewerId: string;
  isOwner: boolean;
  canComment: boolean;
  /** Rows from earlier days recede a step. */
  dim?: boolean;
  /** The viewer owns this meal and is on the free plan. */
  upsell?: boolean;
}) {
  const items = readItems(meal.items);
  const analysing = meal.status === "PENDING" || meal.status === "PROCESSING";
  const complete = meal.status === "COMPLETE";
  const hasDetail =
    Boolean(audioUrl || meal.transcript) ||
    items.length > 0 ||
    meal.comments.length > 0 ||
    canComment ||
    (complete && !meal.aiGenerated);

  return (
    <div
      className={cn(
        "rounded-[14px] border transition-colors",
        dim
          ? "border-line bg-surface-muted"
          : "border-line-strong bg-surface",
      )}
    >
      <div className="flex items-center gap-4 p-3">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="h-[52px] w-[52px] shrink-0 rounded-[11px] object-cover"
          />
        ) : (
          <div className="hatched h-[52px] w-[52px] shrink-0 rounded-[11px]" />
        )}

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-[13.5px] font-semibold",
              dim ? "text-fg-muted" : "text-fg",
            )}
          >
            {meal.title ?? "Logged meal"}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 font-mono text-[11px] uppercase tracking-[0.06em] text-fg-dim">
            <span className="tabular">{time}</span>
            {meal.slot && <span>{SLOT_LABEL[meal.slot] ?? meal.slot}</span>}
            {audioUrl && <span className="text-fg-faint">voice</span>}
            {complete && <EstimateTag analysed={meal.aiGenerated} />}
            {analysing && (
              <span className="flex items-center gap-1.5 text-accent-text">
                <Loader2 className="h-3 w-3 animate-spin" />
                analysing
              </span>
            )}
          </div>
        </div>

        <div className="hidden w-[180px] shrink-0 flex-col gap-1.5 sm:flex">
          <MacroSplitBar macros={meal} className={dim ? "opacity-75" : undefined} />
          <MacroTicks macros={meal} />
        </div>

        <span
          className={cn(
            "tabular w-[70px] shrink-0 text-right font-mono text-[13.5px]",
            dim ? "text-fg-muted" : "text-fg",
          )}
        >
          {round(meal.calories) ?? "—"}
        </span>

        {isOwner && <MealActions meal={meal} />}
      </div>

      {hasDetail && (
        <details className="group border-t border-line">
          <summary className="mono-label flex cursor-pointer list-none items-center gap-1.5 px-3 py-2.5 transition-colors marker:content-none hover:text-fg">
            <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
            Detail
            {meal.comments.length > 0 && (
              <span className="text-accent-text">
                · {meal.comments.length} note
                {meal.comments.length === 1 ? "" : "s"}
              </span>
            )}
          </summary>

          <div className="flex flex-col gap-3.5 px-3 pb-3.5">
            <div className="flex flex-col gap-1.5 sm:hidden">
              <MacroSplitBar macros={meal} />
              <MacroTicks macros={meal} />
            </div>

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
              <ul className="flex flex-col gap-1.5">
                {items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded-[10px] bg-surface-inset px-3 py-2.5 text-[12.5px] text-fg-muted"
                  >
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span className="tabular shrink-0 font-mono text-[12px] text-fg-dim">
                      {item.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <CommentThread
              viewerId={viewerId}
              canComment={canComment}
              target={{ mealId: meal.id }}
              comments={meal.comments.map((c) => ({
                id: c.id,
                body: c.body,
                createdAt: c.createdAt.toISOString(),
                author: c.author,
              }))}
            />
          </div>
        </details>
      )}
    </div>
  );
}
