import Link from "next/link";
import { ChevronRight, Loader2, MessageSquare } from "lucide-react";

import { EstimateTag } from "@/components/billing/analysis-note";
import { MacroSplitBar, MacroTicks } from "@/components/timeline/macros";
import { cn, round } from "@/lib/utils";
import type { TimelineMeal } from "@/services/reporting";

const SLOT_LABEL: Record<string, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
};

/**
 * One meal as a scannable row: photo, what it was, how it split, what it cost.
 *
 * Everything underneath — the ingredients the model read, the recording, the
 * coach's note — is on the meal's own page rather than folded into the line.
 * Fourteen days of meals is fifty rows, and fifty rows each hiding a
 * disclosure triangle is a page nobody can read at a glance, which is the one
 * thing this list is for.
 */
export function MealRow({
  meal,
  imageUrl,
  time,
  dim = false,
}: {
  meal: TimelineMeal;
  imageUrl: string | null;
  time: string;
  /** Rows from earlier days recede a step. */
  dim?: boolean;
}) {
  const analysing = meal.status === "PENDING" || meal.status === "PROCESSING";
  const complete = meal.status === "COMPLETE";

  return (
    <Link
      href={`/dashboard/meals/${meal.id}`}
      className={cn(
        "group flex items-center gap-4 rounded-[14px] border p-3 transition-colors",
        dim
          ? "border-line bg-surface-muted hover:border-line-strong"
          : "border-line-strong bg-surface hover:border-accent-line",
      )}
    >
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
          {complete && <EstimateTag analysed={meal.aiGenerated} />}
          {analysing && (
            <span className="flex items-center gap-1.5 text-accent-text">
              <Loader2 className="h-3 w-3 animate-spin" />
              analysing
            </span>
          )}
          {meal.comments.length > 0 && (
            <span className="flex items-center gap-1 text-accent-text">
              <MessageSquare className="h-3 w-3" />
              {meal.comments.length}
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
          "tabular w-[62px] shrink-0 text-right font-mono text-[13.5px]",
          dim ? "text-fg-muted" : "text-fg",
        )}
      >
        {round(meal.calories) ?? "—"}
      </span>

      <ChevronRight className="h-4 w-4 shrink-0 text-fg-faint transition-colors group-hover:text-accent-text" />
    </Link>
  );
}
