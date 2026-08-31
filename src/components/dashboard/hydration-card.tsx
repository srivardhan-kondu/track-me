import { WaterQuickAdd } from "@/components/log/water-quick-add";
import {
  formatWater,
  hydrationPct,
  litres,
  metGoal,
  remainingMl,
} from "@/lib/hydration";
import { displayVolume, type VolumeUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

/**
 * Today's water, with the taps that log it on the card itself.
 *
 * The rail's other cards report; this one is also where the logging happens,
 * because hydration is the one thing here that gets recorded eight times a day
 * and would not survive a dialog.
 */
export function HydrationCard({
  ml,
  goalMl,
  /** Omitted on today; a YYYY-MM-DD when the page is showing an earlier day. */
  day,
  unit = "ML",
  className,
}: {
  ml: number;
  goalMl: number;
  day?: string;
  unit?: VolumeUnit;
  className?: string;
}) {
  const pct = hydrationPct(ml, goalMl);
  const met = metGoal(ml, goalMl);
  const left = remainingMl(ml, goalMl);

  // Litres for the headline figure, since a day's intake in millilitres is a
  // four-digit number nobody reads at a glance. Ounces stay ounces.
  const headline = unit === "FL_OZ" ? displayVolume(ml, unit) : litres(ml);

  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface p-[18px]",
        className,
      )}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-[12.5px] font-semibold text-fg">Hydration</p>
        <p className="mono-label">goal {formatWater(goalMl, unit)}</p>
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="tabular font-serif text-[30px] leading-none text-fg">
          {ml === 0 ? "0" : headline}
        </span>
        <span className="text-[12px] text-fg-dim">
          {unit === "FL_OZ" ? "fl oz" : "L"}
        </span>
        <span
          className={cn(
            "tabular ml-auto font-mono text-[11.5px] font-medium",
            met ? "text-blue-text" : "text-fg-muted",
          )}
        >
          {pct}%
        </span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-track">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            met ? "bg-blue" : "bg-blue/70",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-2.5 text-[11.5px] leading-relaxed text-fg-dim">
        {met
          ? "Goal met. Anything more is a bonus."
          : ml === 0
            ? "Nothing yet. One glass is one tap."
            : `${formatWater(left, unit)} to go.`}
      </p>

      <WaterQuickAdd day={day} unit={unit} className="mt-3.5" />
    </div>
  );
}
