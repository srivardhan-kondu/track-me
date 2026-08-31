"use client";

import * as React from "react";

import { trailingMeanByDay } from "@/lib/series";
import {
  displayWeight,
  formatWeight,
  weightLabel,
  type WeightUnit,
} from "@/lib/units";
import { cn } from "@/lib/utils";

export type EnergyDay = {
  day: Date;
  calories: number;
  weightKg: number | null;
};

/** Days of trailing mean under the weigh-ins. A week smooths a week's noise. */
const TREND_DAYS = 7;

const fmtDay = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  d.toLocaleDateString(undefined, { timeZone: "UTC", ...opts });

/**
 * Intake and bodyweight, one panel above the other on a single shared axis.
 *
 * Deliberately two panels rather than one plot with two y-scales. Calories run
 * in thousands and weight in tens, so drawing both against one frame means
 * choosing an alignment between the scales — and whatever is chosen invents a
 * correlation that is not in the data. Stacked panels let the eye do the
 * comparison honestly: the x positions line up, and nothing is implied by how
 * two lines happen to cross.
 *
 * The weight panel carries the daily readings as recessive dots and a seven-day
 * trailing mean as the line, because a single morning's weight is mostly water
 * and salt. The trend is the number to read; the dots are there to show how
 * much scatter it was drawn through.
 */
export function EnergyBalance({
  days,
  unit = "KG",
  className,
}: {
  days: EnergyDay[];
  unit?: WeightUnit;
  className?: string;
}) {
  const [active, setActive] = React.useState<number | null>(null);

  const weighed = days
    .map((d, i) => ({ i, day: d.day, weightKg: d.weightKg }))
    .filter((d): d is { i: number; day: Date; weightKg: number } =>
      d.weightKg !== null,
    );

  const trend = trailingMeanByDay(
    weighed.map((w) => ({ day: w.day, value: w.weightKg })),
    TREND_DAYS,
  );
  // The trend is computed on the days that have a reading, then put back on the
  // index those days occupy, so both panels share one x position per day.
  const trendAt = new Map(trend.map((t, n) => [weighed[n].i, t.value]));

  const eaten = days.filter((d) => d.calories > 0);
  const meanCalories = eaten.length
    ? Math.round(eaten.reduce((a, d) => a + d.calories, 0) / eaten.length)
    : 0;
  const maxCalories = Math.max(...days.map((d) => d.calories), 1);
  // Headroom above the tallest day, so the busiest column is not flush to the
  // top of its panel and the mean rule has somewhere to sit.
  const calorieCeiling = maxCalories * 1.12;

  const weights = weighed.map((w) => w.weightKg);
  const trendValues = [...trendAt.values()];
  const lo = Math.min(...weights, ...trendValues);
  const hi = Math.max(...weights, ...trendValues);
  // A minimum span, so a fortnight that barely moved is a flat line rather
  // than a dramatic one drawn through half a kilogram of noise.
  const span = Math.max(1.5, (hi - lo) * 1.4);
  const mid = (hi + lo) / 2;
  const floor = mid - span / 2;

  const y = (kg: number) => 100 - ((kg - floor) / span) * 100;

  const trendPoints = weighed
    .map((w, n) => {
      const value = trend[n].value;
      const x = days.length === 1 ? 50 : (w.i / (days.length - 1)) * 100;
      return `${x.toFixed(2)},${y(value).toFixed(2)}`;
    })
    .join(" ");

  const current = active !== null ? days[active] : null;
  const currentTrend = active !== null ? trendAt.get(active) : undefined;

  const hasWeight = weighed.length > 0;
  const hasCalories = eaten.length > 0;

  /**
   * The hover targets, laid over one plot.
   *
   * Rendered once per panel rather than as a single sheet over the card, so
   * the headings and the legend stay selectable — and because a crosshair
   * drawn through a heading reads as a mistake. Both copies drive the same
   * index, so pointing at a day lights it in both panels at once.
   */
  const HoverLayer = () => (
    <div className="absolute inset-0 flex gap-[2px]">
      {days.map((d, i) => (
        <button
          key={d.day.toISOString()}
          type="button"
          className="relative min-w-0 flex-1 cursor-default focus-visible:outline-none"
          onMouseEnter={() => setActive(i)}
          onFocus={() => setActive(i)}
          onBlur={() => setActive(null)}
        >
          <span className="sr-only">
            {fmtDay(d.day, { weekday: "long", month: "long", day: "numeric" })}
            {": "}
            {d.calories > 0
              ? `${d.calories.toLocaleString()} kcal`
              : "nothing eaten logged"}
            {d.weightKg !== null
              ? `, ${formatWeight(d.weightKg, unit)}`
              : ", no weigh-in"}
          </span>
          {active === i && (
            <span
              className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-line-strong"
              aria-hidden="true"
            />
          )}
        </button>
      ))}
    </div>
  );

  return (
    <div className={className}>
      {/* One hover surface over both panels: the axis is shared, so the
          crosshair has to be too. */}
      <div
        className="relative"
        onMouseLeave={() => setActive(null)}
      >
        {/* ---------------------------------------------------------------
            Panel one — what went in
            --------------------------------------------------------------- */}
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[12.5px] font-semibold text-fg">Eaten</p>
          <p className="tabular font-mono text-[10.5px] text-fg-dim">
            {hasCalories
              ? `${meanCalories.toLocaleString()} kcal average`
              : "nothing logged yet"}
          </p>
        </div>

        <div className="relative mt-3 h-[104px]">
          {hasCalories && (
            <span
              className="absolute inset-x-0 border-t border-line-strong"
              style={{ top: `${100 - (meanCalories / calorieCeiling) * 100}%` }}
              aria-hidden="true"
            />
          )}

          <div className="flex h-full items-end gap-[2px]">
            {days.map((d, i) => (
              <div
                key={d.day.toISOString()}
                className="flex h-full min-w-0 max-w-[24px] flex-1 items-end"
              >
                <div
                  className={cn(
                    "w-full rounded-t-[4px] transition-opacity",
                    d.calories > 0 ? "bg-accent" : "bg-track",
                    active !== null && active !== i && "opacity-40",
                  )}
                  style={{
                    height:
                      d.calories > 0
                        ? `${Math.max(2, (d.calories / calorieCeiling) * 100)}%`
                        : "2px",
                  }}
                />
              </div>
            ))}
          </div>

          <HoverLayer />
        </div>

        {/* ---------------------------------------------------------------
            Panel two — what it did to the scale
            --------------------------------------------------------------- */}
        <div className="mt-6 flex items-baseline justify-between gap-4">
          <p className="text-[12.5px] font-semibold text-fg">Weight</p>

          {hasWeight && (
            <div className="flex items-center gap-3.5">
              <span className="flex items-center gap-1.5 text-[10.5px] text-fg-dim">
                <span className="h-[7px] w-[7px] rounded-full bg-fg-faint" />
                Daily
              </span>
              <span className="flex items-center gap-1.5 text-[10.5px] text-fg-dim">
                <span className="h-[2px] w-4 rounded-full bg-accent" />
                {TREND_DAYS}-day trend
              </span>
            </div>
          )}
        </div>

        <div className="relative mt-3 h-[104px]">
          {hasWeight ? (
            <>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="h-full w-full"
                role="img"
                aria-label={`Bodyweight trend, ${formatWeight(
                  trendValues[0],
                  unit,
                )} to ${formatWeight(trendValues[trendValues.length - 1], unit)}`}
              >
                <polyline
                  points={trendPoints}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {/* Dots in HTML, so a stretched viewBox cannot turn them into
                  ellipses — the same trick the weight chart uses. */}
              {weighed.map((w) => (
                <span
                  key={w.day.toISOString()}
                  className="absolute h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg-faint ring-2 ring-surface"
                  style={{
                    left: `${days.length === 1 ? 50 : (w.i / (days.length - 1)) * 100}%`,
                    top: `${y(w.weightKg)}%`,
                  }}
                  aria-hidden="true"
                />
              ))}
            </>
          ) : (
            <div className="grid h-full place-items-center rounded-xl border border-dashed border-line-strong px-6 text-center">
              <p className="text-[12px] text-fg-dim">
                Weigh in a few mornings and the trend appears here.
              </p>
            </div>
          )}

          <HoverLayer />

          {/*
            Parked in a corner of this panel rather than following the cursor,
            and flipped to whichever side the pointer is not on, so it never
            covers the day being read.
          */}
          {current && (
            <div
              className={cn(
                "pointer-events-none absolute top-0 rounded-[10px] border border-line-strong bg-surface-raised px-3 py-2",
                active !== null && active > days.length / 2 ? "left-0" : "right-0",
              )}
            >
              <p className="mono-label">
                {fmtDay(current.day, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className="tabular mt-1.5 font-mono text-[11.5px] text-fg">
                {current.calories > 0
                  ? `${current.calories.toLocaleString()} kcal`
                  : "— kcal"}
              </p>
              <p className="tabular font-mono text-[11.5px] text-fg-muted">
                {current.weightKg !== null
                  ? formatWeight(current.weightKg, unit)
                  : "no weigh-in"}
                {currentTrend !== undefined &&
                  ` · trend ${displayWeight(currentTrend, unit)}`}
              </p>
            </div>
          )}
        </div>

        {/* The axis both panels are plotted against, stated once. */}
        <div className="mt-2.5 flex justify-between border-t border-line pt-2.5">
          <span className="mono-label">
            {fmtDay(days[0].day, { month: "short", day: "numeric" })}
          </span>
          <span className="mono-label">
            {fmtDay(days[days.length - 1].day, {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>

      </div>

      {/* Every figure above, reachable without a pointer. */}
      <details className="mt-4 border-t border-line pt-3">
        <summary className="cursor-pointer text-[11.5px] text-fg-dim transition-colors hover:text-fg">
          Table view
        </summary>
        <div className="mt-3 max-h-[260px] overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className="mono-label py-2 text-left font-normal">Day</th>
                <th className="mono-label py-2 text-right font-normal">kcal</th>
                <th className="mono-label py-2 text-right font-normal">
                  {weightLabel(unit)}
                </th>
                <th className="mono-label py-2 text-right font-normal">Trend</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d, n) => {
                const i = days.length - 1 - n;
                const t = trendAt.get(i);
                return (
                  <tr key={d.day.toISOString()} className="border-b border-line last:border-0">
                    <td className="py-2 text-[11.5px] text-fg-muted">
                      {fmtDay(d.day, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="tabular py-2 text-right font-mono text-[11.5px] text-fg-muted">
                      {d.calories > 0 ? d.calories.toLocaleString() : "—"}
                    </td>
                    <td className="tabular py-2 text-right font-mono text-[11.5px] text-fg-muted">
                      {d.weightKg !== null ? displayWeight(d.weightKg, unit) : "—"}
                    </td>
                    <td className="tabular py-2 text-right font-mono text-[11.5px] text-fg">
                      {t !== undefined ? displayWeight(t, unit) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
