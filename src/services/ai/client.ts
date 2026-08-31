import OpenAI from "openai";

let cached: OpenAI | null = null;

/**
 * Whether a real model is configured.
 *
 * A function, not a const, on purpose. As a module-load-time constant this
 * froze whatever `process.env` happened to hold at first import — and since
 * importing the Prisma client causes `.env` to be read, merely changing the
 * import order of an unrelated module could flip it. That is exactly how the
 * offline-fallback tests started making real, billed API calls. Reading the
 * environment at call time cannot be reordered into a different answer.
 */
export function aiEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function openai(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!cached) {
    cached = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return cached;
}

export const TRANSCRIBE_MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";
export const VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-4o";
