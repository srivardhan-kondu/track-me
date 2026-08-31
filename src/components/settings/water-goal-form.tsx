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

/**
 * The daily target. Blank is a real answer — it puts the athlete back on the
 * app's default rather than leaving them with nothing to fill toward.
 */
export function WaterGoalForm({ goalMl }: { goalMl: number | null }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function submit(formData: FormData) {
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
        <Label htmlFor="waterGoalMl" className="mb-2 block">
          Daily goal (ml)
        </Label>
        <Input
          id="waterGoalMl"
          name="waterGoalMl"
          type="number"
          step="100"
          inputMode="numeric"
          min={MIN_WATER_GOAL_ML}
          max={MAX_WATER_GOAL_ML}
          defaultValue={goalMl ?? ""}
          placeholder={String(DEFAULT_WATER_GOAL_ML)}
        />
      </div>

      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Save goal"}
      </Button>

      <p className="w-full text-[11.5px] leading-relaxed text-fg-dim">
        Leave it blank to use the default of{" "}
        {DEFAULT_WATER_GOAL_ML.toLocaleString()} ml a day.
      </p>
    </form>
  );
}
