"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Droplets, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { setWater } from "@/app/actions/water";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_WATER_DAY_ML } from "@/lib/hydration";
import { runAction } from "@/lib/run-action";
import {
  displayVolume,
  volumeLabel,
  type VolumeUnit,
} from "@/lib/units";

function todayInput(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Writes a day's total outright.
 *
 * The quick adds cover the ordinary case; this is for the two they cannot —
 * a day logged from memory the morning after, and a figure that came out
 * wrong and needs replacing rather than nudging.
 */
export function WaterForm({
  trigger,
  defaultMl,
  defaultDay,
  unit = "ML",
}: {
  trigger?: React.ReactNode;
  /** The day's running total, in millilitres as stored. */
  defaultMl?: number | null;
  defaultDay?: string;
  unit?: VolumeUnit;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const label = volumeLabel(unit);
  const max = displayVolume(MAX_WATER_DAY_ML, unit);

  const [amount, setAmount] = React.useState(
    defaultMl ? String(displayVolume(defaultMl, unit)) : "",
  );
  const [day, setDay] = React.useState(defaultDay ?? todayInput());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;

    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) {
      toast.error(`Enter an amount between 0 and ${max} ${label}.`);
      return;
    }

    setPending(true);
    const fd = new FormData();
    fd.set("amount", String(parsed));
    fd.set("unit", unit);
    fd.set("day", day);

    const res = await runAction(() => setWater(fd));
    setPending(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success(parsed === 0 ? "Day cleared." : "Water logged.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="gap-2">
            <Droplets className="h-4 w-4" />
            Set total
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Water for the day</DialogTitle>
          <DialogDescription>
            This replaces whatever that day holds rather than adding to it. Zero
            clears the day entirely.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="water-amount">Amount ({label})</Label>
              <Input
                id="water-amount"
                type="number"
                step={unit === "FL_OZ" ? 1 : 50}
                min={0}
                max={max}
                inputMode="numeric"
                placeholder={unit === "FL_OZ" ? "85" : "2500"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="water-day">Date</Label>
              <Input
                id="water-day"
                type="date"
                max={todayInput()}
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
