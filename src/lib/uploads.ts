export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // Whisper's own limit

export const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
];

export const AUDIO_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
];

export type ValidatedFile = {
  buffer: Buffer;
  contentType: string;
};

/**
 * Turns a FormData entry into a validated buffer, or null when absent.
 * Throws a user-facing message when the file is the wrong type or too large.
 */
export async function readUpload(
  value: FormDataEntryValue | null,
  kind: "image" | "audio",
): Promise<ValidatedFile | null> {
  if (!value || typeof value === "string") return null;

  const file = value as File;
  if (file.size === 0) return null;

  const allowed = kind === "image" ? IMAGE_TYPES : AUDIO_TYPES;
  const limit = kind === "image" ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;

  // Browsers append codec parameters, e.g. "audio/webm;codecs=opus".
  const contentType = file.type.split(";")[0].trim().toLowerCase();

  if (!allowed.includes(contentType)) {
    throw new Error(
      kind === "image"
        ? "Unsupported image format. Use JPEG, PNG, WebP or HEIC."
        : "Unsupported audio format.",
    );
  }

  if (file.size > limit) {
    throw new Error(
      `That ${kind} is too large (max ${Math.round(limit / 1024 / 1024)} MB).`,
    );
  }

  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    contentType,
  };
}
