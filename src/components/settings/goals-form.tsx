"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateGoals } from "@/app/actions/goals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_TARGET_CALORIES, MIN_TARGET_CALORIES } from "@/lib/goals";
import { runAction } from "@/lib/run-action";
import {
  displayWeight,
  weightBounds,
  weightLabel,
  type WeightUnit,
} from "@/lib/units";

/**
 * What the athlete is aiming at.
 *
 * Both fields accept blank, and blank clears the target rather than failing —
 * somebody who stops cutting should be able to stop being measured against a
 * number, and hiding that behind a separate "remove" control would be worse
 * than letting an empty box mean what it looks like it means.
 */
export function GoalsForm({
  targetCalories,
  targetWeightKg,
  unit = "KG",
}: {
  targetCalories: number | null;
  /** Stored in kilograms; shown and typed in the athlete's own unit. */
  targetWeightKg: number | null;
  unit?: WeightUnit;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const bounds = weightBounds(unit);

  function submit(formData: FormData) {
    formData.set("unit", unit);
    startTransition(async () => {
      const res = await runAction(() => updateGoals(formData));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Targets saved.");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[140px] flex-1">
        <Label htmlFor="target-calories" className="mb-2 block">
          Daily calories (kcal)
        </Label>
        <Input
          id="target-calories"
          name="calories"
          type="number"
          step={10}
          inputMode="numeric"
          min={MIN_TARGET_CALORIES}
          max={MAX_TARGET_CALORIES}
          defaultValue={targetCalories ?? ""}
          placeholder="Not set"
        />
      </div>

      <div className="min-w-[140px] flex-1">
        <Label htmlFor="target-weight" className="mb-2 block">
          Goal weight ({weightLabel(unit)})
        </Label>
        <Input
          id="target-weight"
          name="weight"
          type="number"
          step={unit === "LB" ? 1 : 0.5}
          inputMode="decimal"
          min={bounds.min}
          max={bounds.max}
          defaultValue={
            targetWeightKg === null ? "" : displayWeight(targetWeightKg, unit)
          }
          placeholder="Not set"
        />
      </div>

      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Save targets"}
      </Button>

      <p className="w-full text-[11.5px] leading-relaxed text-fg-dim">
        Leave either blank and nothing is measured against it. The calorie
        target shows on your home screen beside what you have actually averaged;
        the goal weight shows on your weight card as the distance still to go.
      </p>
    </form>
  );
}
