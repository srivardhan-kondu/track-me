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
    <div className={cn("space-y-2", className)}>
      <span className="text-sm font-medium">{label}</span>

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
        <div className="relative overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Selected meal"
            className="h-48 w-full object-cover"
          />
          {value && (
            <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
              {formatBytes(value.size)}
            </span>
          )}
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute right-2 top-2 h-7 w-7 rounded-full shadow"
            onClick={() => onChange(null)}
            aria-label="Remove photo"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
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
              className="flex-1 gap-2"
              disabled={working}
              onClick={() => galleryRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              Gallery
            </Button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {working ? "Preparing photo…" : hint}
          </p>
        </div>
      )}
    </div>
  );
}
