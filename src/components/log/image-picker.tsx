"use client";

import * as React from "react";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { downscaleImage, formatBytes } from "@/lib/image";
import { cn } from "@/lib/utils";

export function ImagePicker({
  value,
  onChange,
  label = "Photo",
  hint = "A clear shot of the whole plate works best.",
  className,
}: {
  value: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  hint?: string;
  className?: string;
}) {
  const [preview, setPreview] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState(false);
  const galleryRef = React.useRef<HTMLInputElement | null>(null);
  const cameraRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  async function handleFiles(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;

    // Resize before upload: phone photos routinely exceed the request body
    // limit of a serverless deployment.
    setWorking(true);
    try {
      const { file } = await downscaleImage(picked);
      onChange(file);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <span className="text-[12.5px] font-medium text-fg-muted">{label}</span>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {preview ? (
        <div className="relative overflow-hidden rounded-[14px] border border-line-strong">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Selected photo"
            className="h-44 w-full object-cover"
          />

          {value && (
            <span className="absolute bottom-2.5 left-2.5 rounded bg-black/55 px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-white/90 backdrop-blur">
              {formatBytes(value.size)}
            </span>
          )}

          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove photo"
            className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="rounded-[14px] border border-dashed border-line-strong p-3.5">
          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={working}
              onClick={() => cameraRef.current?.click()}
            >
              {working ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              Camera
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={working}
              onClick={() => galleryRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              Gallery
            </Button>
          </div>

          <p className="mt-2.5 text-[11.5px] leading-relaxed text-fg-dim">
            {working ? "Preparing photo…" : hint}
          </p>
        </div>
      )}
    </div>
  );
}
