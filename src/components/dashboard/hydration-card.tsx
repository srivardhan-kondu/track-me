import { WaterQuickAdd } from "@/components/log/water-quick-add";
import {
  formatWater,
  hydrationPct,
  litres,
  metGoal,
  remainingMl,
} from "@/lib/hydration";
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
  className,
}: {
  ml: number;
  goalMl: number;
  day?: string;
  className?: string;
}) {
  const pct = hydrationPct(ml, goalMl);
  const met = metGoal(ml, goalMl);
  const left = remainingMl(ml, goalMl);

  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface p-[18px]",
        className,
      )}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-[12.5px] font-semibold text-fg">Hydration</p>
        <p className="mono-label">goal {formatWater(goalMl)}</p>
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="tabular font-serif text-[30px] leading-none text-fg">
          {ml === 0 ? "0" : litres(ml)}
        </span>
        <span className="text-[12px] text-fg-dim">L</span>
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
            : `${formatWater(left)} to go.`}
      </p>

      <WaterQuickAdd day={day} className="mt-3.5" />
    </div>
  );
}
