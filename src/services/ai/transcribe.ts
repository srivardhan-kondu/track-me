import { toFile } from "openai/uploads";

import { aiEnabled, openai, TRANSCRIBE_MODEL } from "./client";

/**
 * Speech-to-text for meal and workout voice notes.
 * Returns null when no API key is configured — callers fall back to the
 * typed description the athlete can always provide instead.
 */
export async function transcribeAudio(
  audio: Buffer,
  filename = "note.webm",
): Promise<string | null> {
  if (!aiEnabled) return null;

  const file = await toFile(audio, filename);
  const res = await openai().audio.transcriptions.create({
    file,
    model: TRANSCRIBE_MODEL,
  });

  const text = res.text?.trim();
  return text ? text : null;
}
