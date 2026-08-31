"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Loader2, Mic, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createManualWorkout, createWorkout } from "@/app/actions/workouts";
import {
  ExercisePicker,
  type PickedExercise,
} from "@/components/exercises/exercise-picker";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { runAction } from "@/lib/run-action";

function localInputValue(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Row = {
  key: string;
  catalogId: string | null;
  name: string;
  weightKg: string;
  sets: string;
  reps: string;
};

function emptyRow(): Row {
  return {
    key: Math.random().toString(36).slice(2),
    catalogId: null,
    name: "",
    weightKg: "",
    sets: "",
    reps: "",
  };
}

export function WorkoutForm({ trigger }: { trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [mode, setMode] = React.useState("voice");

  // Shared across both modes.
  const [durationMin, setDurationMin] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [performedAt, setPerformedAt] = React.useState(localInputValue());

  // Voice mode.
  const [audio, setAudio] = React.useState<Blob | null>(null);
  const [description, setDescription] = React.useState("");

  // Manual mode.
  const [title, setTitle] = React.useState("");
  const [rows, setRows] = React.useState<Row[]>([emptyRow()]);
  const [pickerFor, setPickerFor] = React.useState<string | null>(null);

  function reset() {
    setAudio(null);
    setDescription("");
    setDurationMin("");
    setNotes("");
    setTitle("");
    setRows([emptyRow()]);
    setPerformedAt(localInputValue());
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function handlePick(exercise: PickedExercise) {
    if (!pickerFor) return;
    updateRow(pickerFor, { catalogId: exercise.id, name: exercise.name });
    setPickerFor(null);
  }

  async function submitVoice(e: React.FormEvent) {
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

    const res = await runAction(() => createWorkout(fd));
    setPending(false);

    if (!res.ok) return void toast.error(res.error);

    toast.success("Workout logged — parsing your sets…");
    reset();
    setOpen(false);
    router.refresh();
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;

    const exercises = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        catalogId: r.catalogId,
        name: r.name.trim(),
        weightKg: r.weightKg ? Number(r.weightKg) : null,
        sets: r.sets ? Number(r.sets) : null,
        reps: r.reps ? Number(r.reps) : null,
      }));

    if (exercises.length === 0) {
      toast.error("Add at least one exercise.");
      return;
    }

    setPending(true);
    const res = await runAction(() =>
      createManualWorkout({
        title: title.trim() || undefined,
        durationMin: durationMin ? Number(durationMin) : null,
        notes: notes.trim() || undefined,
        performedAt: new Date(performedAt).toISOString(),
        exercises,
      }),
    );
    setPending(false);

    if (!res.ok) return void toast.error(res.error);

    toast.success("Workout logged.");
    reset();
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
          <Button>
            <Dumbbell className="h-4 w-4" />
            Log workout
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a workout</DialogTitle>
          <DialogDescription>
            Dictate it, or build it from the exercise catalog.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={setMode}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="voice" className="gap-1.5">
              <Mic className="h-3.5 w-3.5" />
              Voice
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-1.5">
              <Dumbbell className="h-3.5 w-3.5" />
              Build it
            </TabsTrigger>
          </TabsList>

          <TabsContent value="voice">
            <form onSubmit={submitVoice} className="flex flex-col gap-4">
              <VoiceRecorder
                value={audio}
                onChange={setAudio}
                label="Voice note"
                hint="Name each exercise with its weight, sets and reps."
              />

              <div className="flex flex-col gap-2">
                <Label htmlFor="workout-description">
                  Or type it{" "}
                  <span className="text-fg-faint">(optional)</span>
                </Label>
                <Textarea
                  id="workout-description"
                  placeholder={"Bench press 80kg 3 sets of 8\nIncline dumbbell press 30kg 3x10"}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <SharedFields
                durationMin={durationMin}
                setDurationMin={setDurationMin}
                performedAt={performedAt}
                setPerformedAt={setPerformedAt}
                notes={notes}
                setNotes={setNotes}
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
                  Log workout
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="manual">
            <form onSubmit={submitManual} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="workout-title">
                  Session name{" "}
                  <span className="text-fg-faint">(optional)</span>
                </Label>
                <Input
                  id="workout-title"
                  placeholder="Push day"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Exercises</Label>
                <div className="flex flex-col gap-2">
                  {rows.map((row, i) => (
                    <div
                      key={row.key}
                      className="rounded-[12px] border border-line p-3"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPickerFor(row.key)}
                          className="min-w-0 flex-1 truncate rounded-[10px] border border-line-strong bg-surface-inset px-3 py-2 text-left text-[12.5px] text-fg transition-colors hover:bg-hover"
                        >
                          {row.name || (
                            <span className="text-fg-faint">
                              Choose exercise {i + 1}…
                            </span>
                          )}
                        </button>

                        {rows.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 shrink-0 text-fg-faint hover:text-clay-text"
                            onClick={() =>
                              setRows((rs) => rs.filter((r) => r.key !== row.key))
                            }
                            aria-label="Remove exercise"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          min={0}
                          placeholder="kg"
                          aria-label="Weight in kilograms"
                          value={row.weightKg}
                          onChange={(e) =>
                            updateRow(row.key, { weightKg: e.target.value })
                          }
                        />
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder="sets"
                          aria-label="Sets"
                          value={row.sets}
                          onChange={(e) =>
                            updateRow(row.key, { sets: e.target.value })
                          }
                        />
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder="reps"
                          aria-label="Reps"
                          value={row.reps}
                          onChange={(e) =>
                            updateRow(row.key, { reps: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setRows((rs) => [...rs, emptyRow()])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add exercise
                </Button>
              </div>

              <SharedFields
                durationMin={durationMin}
                setDurationMin={setDurationMin}
                performedAt={performedAt}
                setPerformedAt={setPerformedAt}
                notes={notes}
                setNotes={setNotes}
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
                  Log workout
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>

      <ExercisePicker
        open={pickerFor !== null}
        onOpenChange={(next) => !next && setPickerFor(null)}
        onPick={handlePick}
      />
    </Dialog>
  );
}

function SharedFields({
  durationMin,
  setDurationMin,
  performedAt,
  setPerformedAt,
  notes,
  setNotes,
}: {
  durationMin: string;
  setDurationMin: (v: string) => void;
  performedAt: string;
  setPerformedAt: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="workout-time">Performed at</Label>
          <Input
            id="workout-time"
            type="datetime-local"
            value={performedAt}
            onChange={(e) => setPerformedAt(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="workout-notes">
          How did it feel?{" "}
          <span className="text-fg-faint">(optional)</span>
        </Label>
        <Input
          id="workout-notes"
          placeholder="Left shoulder a bit tight"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </>
  );
}
