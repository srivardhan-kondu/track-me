"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";

import { addWater } from "@/app/actions/water";
import { formatWater, quickAdds } from "@/lib/hydration";
import { runAction } from "@/lib/run-action";
import { displayVolume, type VolumeUnit } from "@/lib/units";
import { cn } from "@/lib/utils";

/**
 * The three taps that do all the work: a glass, a bottle, a litre.
 *
 * Logging water has to cost one tap or nobody does it twice, so these commit
 * straight away rather than opening the dialog the other logs use. The last
 * one is undoable for exactly that reason — the price of a misfire has to
 * stay one tap too.
 */
export function WaterQuickAdd({
  /** Which day the taps land on. Omitted means today, in the athlete's zone. */
  day,
  unit = "ML",
  className,
}: {
  day?: string;
  unit?: VolumeUnit;
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<number | null>(null);
  const [lastAdded, setLastAdded] = React.useState<number | null>(null);

  async function add(ml: number) {
    if (pending !== null) return;
    setPending(ml);

    const res = await runAction(() => addWater(ml, day));
    setPending(null);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    setLastAdded(ml > 0 ? ml : null);
    if (ml > 0) toast.success(`${formatWater(ml, unit)} logged.`);
    router.refresh();
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {quickAdds(unit).map((preset) => (
        <button
          key={preset.ml}
          type="button"
          onClick={() => add(preset.ml)}
          disabled={pending !== null}
          className={cn(
            "flex items-baseline gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-colors disabled:opacity-50",
            pending === preset.ml
              ? "border-blue bg-blue-soft text-blue-text"
              : "border-line-strong text-fg-muted hover:border-blue hover:bg-blue-soft hover:text-fg",
          )}
        >
          <span>{preset.label}</span>
          <span className="tabular font-mono text-[10.5px] text-fg-dim">
            +{displayVolume(preset.ml, unit)}
          </span>
        </button>
      ))}

      {lastAdded !== null && (
        <button
          type="button"
          onClick={() => add(-lastAdded)}
          disabled={pending !== null}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-2 text-[12px] font-medium text-fg-faint transition-colors hover:text-fg-muted disabled:opacity-50"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Undo
        </button>
      )}
    </div>
  );
}
