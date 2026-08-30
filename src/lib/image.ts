/**
 * Client-side image downscaling.
 *
 * Phone cameras produce 3–12 MB images, but serverless platforms cap request
 * bodies well below that (Vercel allows 4.5 MB). Resizing in the browser keeps
 * uploads fast on mobile data and well inside the limit, and costs no quality
 * that a nutrition estimate can use.
 */

/** Longest edge, in pixels, kept after downscaling. */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

/** Anything at or below this is already small enough to send untouched. */
const SKIP_BELOW_BYTES = 400 * 1024;

export type DownscaleResult = {
  file: File;
  /** True when the image was actually re-encoded. */
  changed: boolean;
};

function canDownscale(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof createImageBitmap === "function" &&
    typeof document !== "undefined"
  );
}

/**
 * Returns a smaller JPEG when that helps, otherwise the original file.
 * Never throws — a failure to decode falls back to the untouched file, so an
 * unusual format can still be uploaded and handled server-side.
 */
export async function downscaleImage(file: File): Promise<DownscaleResult> {
  if (!canDownscale() || file.size <= SKIP_BELOW_BYTES) {
    return { file, changed: false };
  }

  try {
    // `from-image` applies the EXIF orientation, so portrait photos taken on a
    // phone do not come out rotated.
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });

    const { width, height } = bitmap;
    const longest = Math.max(width, height);
    const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;

    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return { file, changed: false };
    }

    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );

    // Keep the original when re-encoding did not actually help.
    if (!blob || blob.size >= file.size) {
      return { file, changed: false };
    }

    const name = file.name.replace(/\.[^.]+$/, "") || "photo";
    return {
      file: new File([blob], `${name}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      }),
      changed: true,
    };
  } catch {
    // HEIC on a browser that cannot decode it, a corrupt file, a blocked
    // canvas — send the original and let the server decide.
    return { file, changed: false };
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
