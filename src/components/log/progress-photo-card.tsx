"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteProgressPhoto } from "@/app/actions/weight";
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
    <figure className="group relative aspect-[3/4] overflow-hidden rounded-[11px] border border-line bg-surface-inset">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`${pose} pose taken ${takenAt}`}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="hatched grid h-full w-full place-items-center">
          <span className="mono-label">Unavailable</span>
        </div>
      )}

      <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent px-2.5 py-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/90">
          {takenAt}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/60">
          {pose}
        </span>
      </figcaption>

      {canDelete && (
        <button
          type="button"
          onClick={remove}
          aria-label="Delete photo"
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/75 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </figure>
  );
}
