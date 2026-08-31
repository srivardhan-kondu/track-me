"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Scale } from "lucide-react";
import { toast } from "sonner";

import { logWeight } from "@/app/actions/weight";
import { ImagePicker } from "@/components/log/image-picker";
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
import { runAction } from "@/lib/run-action";
import {
  displayWeight,
  weightBounds,
  weightLabel,
  type WeightUnit,
} from "@/lib/units";

function todayInput(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function WeightForm({
  trigger,
  defaultWeight,
  unit = "KG",
}: {
  trigger?: React.ReactNode;
  /** The last check-in, in kilograms as stored. */
  defaultWeight?: number | null;
  unit?: WeightUnit;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const bounds = weightBounds(unit);
  const label = weightLabel(unit);

  // Prefilled in the unit on screen; what the athlete sees is what they edit.
  const [weight, setWeight] = React.useState(
    defaultWeight ? String(displayWeight(defaultWeight, unit)) : "",
  );
  const [notes, setNotes] = React.useState("");
  const [day, setDay] = React.useState(todayInput());
  const [photo, setPhoto] = React.useState<File | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;

    const parsed = Number(weight);
    if (!Number.isFinite(parsed) || parsed < bounds.min || parsed > bounds.max) {
      toast.error(`Enter a weight between ${bounds.min} and ${bounds.max} ${label}.`);
      return;
    }

    setPending(true);
    const fd = new FormData();
    fd.set("weight", weight);
    fd.set("unit", unit);
    fd.set("day", day);
    if (notes.trim()) fd.set("notes", notes.trim());
    if (photo) fd.set("photo", photo);

    const res = await runAction(() => logWeight(fd));
    setPending(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success("Check-in saved.");
    setNotes("");
    setPhoto(null);
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
          <Button className="gap-2">
            <Scale className="h-4 w-4" />
            Check in
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Morning check-in</DialogTitle>
          <DialogDescription>
            Weigh yourself after waking and before eating for a consistent
            trend. One entry per day — logging again updates it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="weight-value">Weight ({label})</Label>
              <Input
                id="weight-value"
                type="number"
                step={bounds.step}
                min={bounds.min}
                max={bounds.max}
                inputMode="decimal"
                placeholder={unit === "LB" ? "169.9" : "77.05"}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="weight-day">Date</Label>
              <Input
                id="weight-day"
                type="date"
                max={todayInput()}
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="weight-notes">
              Notes <span className="text-fg-faint">(optional)</span>
            </Label>
            <Input
              id="weight-notes"
              placeholder="Slept badly, feeling flat"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <ImagePicker
            value={photo}
            onChange={setPhoto}
            label="Check-in photo (optional)"
            hint="Same lighting and pose each time makes the trend readable."
          />

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
              Save check-in
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
