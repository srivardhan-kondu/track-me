import OpenAI from "openai";

let cached: OpenAI | null = null;

export const aiEnabled = Boolean(process.env.OPENAI_API_KEY);

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
