"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteProgressPhoto } from "@/app/actions/weight";
import { Button } from "@/components/ui/button";
import { runAction } from "@/lib/run-action";

export function ProgressPhotoCard({
  id,
  url,
  pose,
  takenAt,
  canDelete,
}: {
  id: string;
  url: string | null;
  pose: string;
  takenAt: string;
  canDelete: boolean;
}) {
  const router = useRouter();

  async function remove() {
    const res = await runAction(() => deleteProgressPhoto(id));
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Photo deleted.");
    router.refresh();
  }

  return (
    <figure className="group relative overflow-hidden rounded-lg border border-border bg-muted">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`${pose} pose taken ${takenAt}`}
          className="aspect-[3/4] w-full object-cover"
        />
      ) : (
        <div className="grid aspect-[3/4] w-full place-items-center text-xs text-muted-foreground">
          Unavailable
        </div>
      )}

      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-[11px] font-medium text-white">
        {pose} · {takenAt}
      </figcaption>

      {canDelete && (
        <Button
          size="icon"
          variant="secondary"
          onClick={remove}
          aria-label="Delete photo"
          className="absolute right-1.5 top-1.5 h-7 w-7 opacity-0 shadow transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </figure>
  );
}
