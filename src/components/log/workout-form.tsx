"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createWorkout } from "@/app/actions/workouts";
import { VoiceRecorder } from "@/components/log/voice-recorder";
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
import { Textarea } from "@/components/ui/textarea";

function localInputValue(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function WorkoutForm({ trigger }: { trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const [audio, setAudio] = React.useState<Blob | null>(null);
  const [description, setDescription] = React.useState("");
  const [durationMin, setDurationMin] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [performedAt, setPerformedAt] = React.useState(localInputValue());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;

    if (!audio && !description.trim()) {
      toast.error("Record a voice note or type what you did.");
      return;
    }

    setPending(true);
    const fd = new FormData();
    if (audio) {
      const ext = audio.type.includes("mp4") ? "m4a" : "webm";
      fd.set("audio", new File([audio], `note.${ext}`, { type: audio.type }));
    }
    if (description.trim()) fd.set("description", description.trim());
    if (durationMin) fd.set("durationMin", durationMin);
    if (notes.trim()) fd.set("notes", notes.trim());
    fd.set("performedAt", new Date(performedAt).toISOString());

    const res = await createWorkout(fd);
    setPending(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success("Workout logged — parsing your sets…");
    setAudio(null);
    setDescription("");
    setDurationMin("");
    setNotes("");
    setPerformedAt(localInputValue());
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
            <Dumbbell className="h-4 w-4" />
            Log workout
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a workout</DialogTitle>
          <DialogDescription>
            Dictate it the way you would say it out loud — &ldquo;bench press 80
            kilos, 3 sets of 8&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <VoiceRecorder
            value={audio}
            onChange={setAudio}
            label="Voice note"
            hint="Name each exercise with its weight, sets and reps."
          />

          <div className="space-y-2">
            <Label htmlFor="workout-description">
              Or type it{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="workout-description"
              placeholder={"Bench press 80kg 3 sets of 8\nIncline dumbbell press 30kg 3x10"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="workout-duration">Duration (min)</Label>
              <Input
                id="workout-duration"
                type="number"
                min={0}
                max={600}
                inputMode="numeric"
                placeholder="60"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workout-time">Performed at</Label>
              <Input
                id="workout-time"
                type="datetime-local"
                value={performedAt}
                onChange={(e) => setPerformedAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workout-notes">
              How did it feel?{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="workout-notes"
              placeholder="Left shoulder a bit tight"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
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
              Log workout
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
