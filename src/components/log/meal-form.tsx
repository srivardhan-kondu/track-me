"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { createMeal, updateMealItems } from "@/app/actions/meals";
import { ImagePicker } from "@/components/log/image-picker";
import { IngredientTable } from "@/components/log/ingredient-table";
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
import { seedMealItems, type MealItem } from "@/lib/meal-items";
import { runAction } from "@/lib/run-action";

/** How long to wait for the analysis before offering the table empty. */
const REVIEW_TIMEOUT_MS = 75_000;

/** Local datetime string for a datetime-local input. */
function localInputValue(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MealForm({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  /*
    Two steps in one dialog. "compose" captures the meal; "review" shows what
    the model heard, as an editable table, before the athlete walks away from
    it. The meal is already saved by the time review opens — closing the dialog
    keeps the estimate rather than losing the log.
  */
  const [step, setStep] = React.useState<"compose" | "review">("compose");
  const [mealId, setMealId] = React.useState<string | null>(null);
  const [analysing, setAnalysing] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [transcript, setTranscript] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [items, setItems] = React.useState<MealItem[]>([]);

  const [image, setImage] = React.useState<File | null>(null);
  const [audio, setAudio] = React.useState<Blob | null>(null);
  const [description, setDescription] = React.useState("");
  const [eatenAt, setEatenAt] = React.useState(localInputValue());

  function resetForm() {
    setImage(null);
    setAudio(null);
    setDescription("");
    setEatenAt(localInputValue());
    setStep("compose");
    setMealId(null);
    setAnalysing(false);
    setFailed(null);
    setTranscript(null);
    setTitle("");
    setItems([]);
  }

  /**
   * Waits for the queued analysis, then fills the review table.
   *
   * Polls rather than streams: the work happens in a job the request does not
   * own, so there is nothing to hold a connection open on. Backs off from half
   * a second to three so a slow model call does not turn into a hot loop.
   */
  async function waitForAnalysis(id: string) {
    setAnalysing(true);
    setFailed(null);

    const started = Date.now();
    let delay = 600;

    while (Date.now() - started < REVIEW_TIMEOUT_MS) {
      try {
        const res = await fetch(`/api/meals/${id}`, { cache: "no-store" });
        if (res.ok) {
          const meal = await res.json();

          if (meal.status === "COMPLETE") {
            setItems(seedMealItems(meal));
            setTitle(meal.title ?? "");
            setTranscript(meal.transcript ?? null);
            setAnalysing(false);
            return;
          }

          if (meal.status === "FAILED") {
            setTranscript(meal.transcript ?? null);
            setFailed(
              meal.error ??
                "The estimate did not come back. Enter what you ate below.",
            );
            setItems(seedMealItems(meal));
            setAnalysing(false);
            return;
          }
        }
      } catch {
        // A dropped poll is not a failure; the next one decides.
      }

      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(3000, Math.round(delay * 1.4));
    }

    setFailed(
      "This is taking longer than usual. Your meal is saved — you can correct it from the timeline once the estimate lands.",
    );
    setAnalysing(false);
  }

  async function saveReview() {
    if (!mealId) return;
    setPending(true);

    const cleaned = items.filter((item) => item.name.trim().length > 0);
    const res = await runAction(() =>
      updateMealItems({ mealId, title: title.trim() || undefined, items: cleaned }),
    );
    setPending(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success("Meal saved.");
    resetForm();
    setOpen(false);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;

    if (!image && !audio && !description.trim()) {
      toast.error("Add a photo, a voice note, or a short description.");
      return;
    }

    setPending(true);
    const fd = new FormData();
    if (image) fd.set("image", image);
    if (audio) {
      const ext = audio.type.includes("mp4") ? "m4a" : "webm";
      fd.set("audio", new File([audio], `note.${ext}`, { type: audio.type }));
    }
    if (description.trim()) fd.set("description", description.trim());
    fd.set("eatenAt", new Date(eatenAt).toISOString());

    const res = await runAction(() => createMeal(fd));
    setPending(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    if (!res.id) {
      // Nothing to review without an id; the timeline still gets the meal.
      toast.success("Meal logged — estimating macros…");
      resetForm();
      setOpen(false);
      router.refresh();
      return;
    }

    setMealId(res.id);
    setStep("review");
    router.refresh();
    void waitForAnalysis(res.id);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) resetForm();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add meal
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className={step === "review" ? "max-w-xl" : undefined}>
        <DialogHeader>
          <DialogTitle>
            {step === "compose" ? "Log a meal" : "Check what we heard"}
          </DialogTitle>
          <DialogDescription>
            {step === "compose"
              ? "A photo and a few spoken words are enough — Track Me works out the macros."
              : "These are the ingredients we picked out. Correct anything that is wrong — the totals follow the rows."}
          </DialogDescription>
        </DialogHeader>

        {step === "review" ? (
          <div className="flex min-w-0 flex-col gap-4">
            {analysing ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-accent-text" />
                <p className="text-[13px] text-fg-muted">
                  Working out the ingredients…
                </p>
                <p className="max-w-[18rem] text-[12px] leading-relaxed text-fg-dim">
                  Your meal is already saved. This usually takes a few seconds.
                </p>
              </div>
            ) : (
              <>
                {failed && (
                  <p className="rounded-[14px] border border-clay-line bg-clay-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-clay-text">
                    {failed}
                  </p>
                )}

                {transcript && (
                  <div className="flex flex-col gap-1.5">
                    <p className="mono-label">What we heard</p>
                    <p className="rounded-[14px] border border-line bg-surface-muted px-3.5 py-3 text-[13px] italic leading-relaxed text-fg-muted">
                      &ldquo;{transcript}&rdquo;
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Label htmlFor="meal-title">Meal</Label>
                  <Input
                    id="meal-title"
                    value={title}
                    placeholder="Lunch"
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                  <Label>Ingredients</Label>
                  <IngredientTable
                    items={items}
                    onChange={setItems}
                    disabled={pending}
                  />
                </div>
              </>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  resetForm();
                  setOpen(false);
                  router.refresh();
                }}
                disabled={pending}
              >
                {analysing ? "Review later" : "Keep the estimate"}
              </Button>
              <Button
                type="button"
                onClick={saveReview}
                disabled={pending || analysing}
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save meal
              </Button>
            </DialogFooter>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <ImagePicker value={image} onChange={setImage} />

          <VoiceRecorder value={audio} onChange={setAudio} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="meal-description">
              Notes <span className="text-fg-faint">(optional)</span>
            </Label>
            <Textarea
              id="meal-description"
              placeholder="200g chicken breast, one cup of rice, salad"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="meal-time">Eaten at</Label>
            <Input
              id="meal-time"
              type="datetime-local"
              value={eatenAt}
              onChange={(e) => setEatenAt(e.target.value)}
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
              Log meal
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
