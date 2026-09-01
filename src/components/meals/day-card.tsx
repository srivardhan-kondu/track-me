import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { MacroRow, MacroSplitBar } from "@/components/timeline/macros";
import { cn } from "@/lib/utils";

/**
 * A finished day of eating, as one card.
 *
 * Nobody scrolling back through a fortnight wants to read what they had for
 * lunch three Tuesdays ago plate by plate — they want to know whether the day
 * landed. So a completed day collapses to what it added up to, and the plates
 * are one tap away for the day somebody actually has a question about.
 *
 * Today is the exception and stays open on the meals page: it is still being
 * written, and a total is not much use until it is finished.
 */
export function DayCard({
  href,
  label,
  meals,
  totals,
}: {
  href: string;
  /** "Monday, Aug 31" — the day this card stands for. */
  label: string;
  meals: number;
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    /** Omitted from the card entirely when no meal that day carried one. */
    fiber: number | null;
  };
}) {
  const figures = [
    { label: "Calories", value: totals.calories },
    { label: "Protein", value: totals.protein, unit: "g" },
    { label: "Carbs", value: totals.carbs, unit: "g" },
    { label: "Fat", value: totals.fat, unit: "g" },
    ...(totals.fiber !== null
      ? [{ label: "Fibre", value: totals.fiber, unit: "g" }]
      : []),
  ];

  return (
    <Link
      href={href}
      className="group flex flex-col rounded-[14px] border border-line bg-surface-muted p-4 transition-colors hover:border-line-strong hover:bg-surface"
    >
      <div className="flex items-center gap-3.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-fg">
            {label}
          </span>
          <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.06em] text-fg-dim">
            {meals} meal{meals === 1 ? "" : "s"}
          </span>
        </span>

        <ChevronRight className="h-4 w-4 shrink-0 text-fg-faint transition-colors group-hover:text-accent-text" />
      </div>

      {/*
        Three across on a phone so five figures wrap rather than shrink to
        something unreadable; all of them on one line once there is room.
      */}
      <div
        className={cn(
          "mt-4 grid grid-cols-3 gap-x-3 gap-y-4",
          figures.length === 5 ? "sm:grid-cols-5" : "sm:grid-cols-4",
        )}
      >
        {figures.map((f) => (
          <Figure
            key={f.label}
            label={f.label}
            value={Math.round(f.value)}
            unit={f.unit}
          />
        ))}
      </div>

      <MacroSplitBar macros={totals} className="mt-4" />
      <MacroRow macros={totals} className="mt-3" />
    </Link>
  );
}

function Figure({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="mono-label">{label}</p>
      <p className="tabular mt-1 truncate text-[15px] font-extrabold leading-none text-fg">
        {value.toLocaleString()}
        {unit && (
          <span className="ml-0.5 text-[11px] font-semibold text-fg-dim">
            {unit}
          </span>
        )}
      </p>
    </div>
  );
}
