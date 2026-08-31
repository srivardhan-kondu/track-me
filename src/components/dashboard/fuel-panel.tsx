import { cn } from "@/lib/utils";
import type { DayTotals } from "@/services/reporting";

/** The athlete's own recent average, used as the reference line for the day. */
export type MacroBaseline = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Days of history the averages are drawn from. */
  days: number;
};

const MACROS = [
  { key: "protein", label: "Protein", bar: "bg-protein" },
  { key: "carbs", label: "Carbs", bar: "bg-carbs" },
  { key: "fat", label: "Fat", bar: "bg-fat" },
] as const;

/**
 * Bars run to 1.5× the reference, so a typical day sits two-thirds along and
 * a heavy one still has somewhere to go. Filling to the average alone would
 * peg every bar at 100% the moment it was met.
 */
const HEADROOM = 1.5;
const MARK = `${Math.round((100 / HEADROOM) * 10) / 10}%`;

function pct(value: number, reference: number) {
  if (reference <= 0) return value > 0 ? 100 : 0;
  return Math.min(100, Math.round((value / (reference * HEADROOM)) * 100));
}

/** The track, with a tick where the athlete's own average sits. */
function Track({
  fill,
  color,
  marked,
  className,
}: {
  fill: number;
  color: string;
  marked: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-full bg-track", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", color)}
        style={{ width: `${fill}%` }}
      />
      {marked && (
        <span
          className="absolute inset-y-0 w-px bg-bg/70"
          style={{ left: MARK }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/**
 * One panel for the whole day's fuel, instead of four identical stat cards.
 *
 * Track Me stores no calorie target, so the reference each bar fills toward is
 * the athlete's own recent average — a line they set themselves.
 */
export function FuelPanel({
  totals,
  baseline,
  label = "Eaten today",
}: {
  totals: DayTotals;
  baseline: MacroBaseline;
  label?: string;
}) {
  const hasBaseline = baseline.calories > 0;
  const diff = Math.round(totals.calories - baseline.calories);

  return (
    <section className="grid gap-7 rounded-2xl border border-line-strong bg-surface-raised px-7 py-6 md:grid-cols-[0.85fr_1px_1.3fr]">
      <div className="flex flex-col justify-center">
        <p className="mono-label">{label}</p>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="tabular font-serif text-[52px] leading-none text-fg">
            {totals.calories.toLocaleString()}
          </span>
          <span className="text-[13px] font-medium text-fg-dim">kcal</span>
        </div>

        <p className="mt-1.5 text-[12.5px] text-fg-dim">
          {totals.mealCount} meal{totals.mealCount === 1 ? "" : "s"}
          {hasBaseline ? (
            <>
              {" · "}
              {diff === 0
                ? "right on your usual day"
                : `${diff > 0 ? "+" : ""}${diff.toLocaleString()} vs your usual ${baseline.calories.toLocaleString()}`}
            </>
          ) : (
            " logged"
          )}
        </p>

        <Track
          className="mt-5 h-1.5"
          fill={pct(totals.calories, baseline.calories)}
          color="bg-accent"
          marked={hasBaseline}
        />
      </div>

      <div className="hidden bg-line-strong md:block" />

      <div className="flex flex-col justify-center gap-4">
        {MACROS.map(({ key, label: name, bar }) => {
          const value = Math.round(totals[key]);
          const reference = Math.round(baseline[key]);

          return (
            <div key={key}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] font-medium text-fg-muted">
                  {name}
                </span>
                <span className="tabular font-mono text-[11.5px] text-fg-dim">
                  {value} g{reference > 0 && ` · avg ${reference}`}
                </span>
              </div>
              <Track
                className="h-[5px]"
                fill={pct(value, reference)}
                color={bar}
                marked={reference > 0}
              />
            </div>
          );
        })}

        {!hasBaseline && (
          <p className="text-[11.5px] leading-relaxed text-fg-faint">
            Averages appear once you have a few days logged — then each bar
            fills toward your own usual day.
          </p>
        )}
      </div>
    </section>
  );
}
