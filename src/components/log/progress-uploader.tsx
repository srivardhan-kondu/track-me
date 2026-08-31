"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { uploadProgressPhoto } from "@/app/actions/weight";
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
import { ChoiceTile } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runAction } from "@/lib/run-action";

const POSES = [
  { value: "FRONT", label: "Front" },
  { value: "SIDE", label: "Side" },
  { value: "BACK", label: "Back" },
] as const;

function todayInput(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ProgressUploader({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [pose, setPose] = React.useState<"FRONT" | "SIDE" | "BACK">("FRONT");
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [takenAt, setTakenAt] = React.useState(todayInput());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;

    if (!photo) {
      toast.error("Choose a photo first.");
      return;
    }

    setPending(true);
    const fd = new FormData();
    fd.set("pose", pose);
    fd.set("photo", photo);
    fd.set("takenAt", new Date(`${takenAt}T12:00:00`).toISOString());

    const res = await runAction(() => uploadProgressPhoto(fd));
    setPending(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success("Progress photo saved.");
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
          <Button>
            <Camera className="h-4 w-4" />
            Add photo
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Progress photo</DialogTitle>
          <DialogDescription>
            Same lighting, same distance, same time of day. Consistency is what
            makes the comparison readable.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Pose</Label>
            <div className="grid grid-cols-3 gap-2.5">
              {POSES.map((p) => (
                <ChoiceTile
                  key={p.value}
                  title={p.label}
                  selected={pose === p.value}
                  onClick={() => setPose(p.value)}
                />
              ))}
            </div>
          </div>

          <ImagePicker
            value={photo}
            onChange={setPhoto}
            label="Photo"
            hint="Neutral background, relaxed posture."
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="progress-date">Taken on</Label>
            <Input
              id="progress-date"
              type="date"
              max={todayInput()}
              value={takenAt}
              onChange={(e) => setTakenAt(e.target.value)}
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
              Save photo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
