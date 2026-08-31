import { toFile } from "openai/uploads";

import { aiEnabled, openai, TRANSCRIBE_MODEL } from "./client";
import { transcriptionCostUnits } from "./pricing";
import { withRetry } from "./retry";

/**
 * Speech-to-text for meal and workout voice notes.
 * Returns null when no API key is configured, or when the athlete is not on a
 * plan that includes AI — callers fall back to the typed description the
 * athlete can always provide instead.
 */
export type Transcription = {
  text: string | null;
  /** What the call cost, for the caller to record. Zero when nothing ran. */
  costUnits: number;
};

export async function transcribeAudio(
  audio: Buffer,
  filename = "note.webm",
  useAi: boolean = aiEnabled(),
): Promise<Transcription> {
  if (!useAi || !aiEnabled()) return { text: null, costUnits: 0 };

  const file = await toFile(audio, filename);
  const res = await withRetry("transcribeAudio", () =>
    openai().audio.transcriptions.create({
      file,
      model: TRANSCRIBE_MODEL,
    }),
  );

  const text = res.text?.trim();
  return {
    text: text ? text : null,
    costUnits: transcriptionCostUnits(audio.byteLength),
  };
}
