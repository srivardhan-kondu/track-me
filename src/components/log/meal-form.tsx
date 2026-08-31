"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { createMeal } from "@/app/actions/meals";
import { ImagePicker } from "@/components/log/image-picker";
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

  const [image, setImage] = React.useState<File | null>(null);
  const [audio, setAudio] = React.useState<Blob | null>(null);
  const [description, setDescription] = React.useState("");
  const [eatenAt, setEatenAt] = React.useState(localInputValue());

  function resetForm() {
    setImage(null);
    setAudio(null);
    setDescription("");
    setEatenAt(localInputValue());
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

    const res = await createMeal(fd);
    setPending(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success("Meal logged — estimating macros…");
    resetForm();
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
            <Plus className="h-4 w-4" />
            Add meal
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a meal</DialogTitle>
          <DialogDescription>
            A photo and a few spoken words are enough — Track Me works out the
            macros.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ImagePicker value={image} onChange={setImage} />

          <VoiceRecorder value={audio} onChange={setAudio} />

          <div className="space-y-2">
            <Label htmlFor="meal-description">
              Notes <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="meal-description"
              placeholder="200g chicken breast, one cup of rice, salad"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
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
      </DialogContent>
    </Dialog>
  );
}
