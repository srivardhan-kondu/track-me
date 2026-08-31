"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateWaterGoal } from "@/app/actions/water";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_WATER_GOAL_ML,
  MAX_WATER_GOAL_ML,
  MIN_WATER_GOAL_ML,
} from "@/lib/hydration";
import { runAction } from "@/lib/run-action";
import {
  displayVolume,
  formatVolume,
  volumeLabel,
  type VolumeUnit,
} from "@/lib/units";

/**
 * The daily target. Blank is a real answer — it puts the athlete back on the
 * app's default rather than leaving them with nothing to fill toward.
 */
export function WaterGoalForm({
  goalMl,
  unit = "ML",
}: {
  /** What is stored, in millilitres. Null means the athlete never set one. */
  goalMl: number | null;
  unit?: VolumeUnit;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const label = volumeLabel(unit);

  function submit(formData: FormData) {
    formData.set("unit", unit);
    startTransition(async () => {
      const res = await runAction(() => updateWaterGoal(formData));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Goal saved.");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[140px] flex-1">
        <Label htmlFor="water-goal" className="mb-2 block">
          Daily goal ({label})
        </Label>
        <Input
          id="water-goal"
          name="goal"
          type="number"
          step={unit === "FL_OZ" ? 1 : 100}
          inputMode="numeric"
          min={displayVolume(MIN_WATER_GOAL_ML, unit)}
          max={displayVolume(MAX_WATER_GOAL_ML, unit)}
          defaultValue={goalMl ? displayVolume(goalMl, unit) : ""}
          placeholder={String(displayVolume(DEFAULT_WATER_GOAL_ML, unit))}
        />
      </div>

      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Save goal"}
      </Button>

      <p className="w-full text-[11.5px] leading-relaxed text-fg-dim">
        Leave it blank to use the default of{" "}
        {formatVolume(DEFAULT_WATER_GOAL_ML, unit)} a day.
      </p>
    </form>
  );
}
