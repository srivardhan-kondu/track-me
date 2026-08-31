/**
 * What a model call costs, in tenths of a cent.
 *
 * Deliberately free of any database import. The AI services need this maths,
 * and pulling the Prisma client into their import graph has a consequence that
 * is not obvious: Prisma loads `.env` when it initialises, so importing it
 * populates `process.env` — which flipped `aiEnabled` to true in the test
 * process and had the offline-fallback tests quietly making real, billed API
 * calls. Pricing stays pure; the ledger that records it lives in `budget.ts`
 * and is only ever touched by callers that already have a database.
 */

/** 1000 units = 1 USD. Integers throughout, so nothing rounds to free. */
export const UNITS_PER_USD = 1000;

/**
 * List prices per million tokens, and per minute of audio.
 *
 * Estimates for a safety rail, not billing — they only have to be the right
 * order of magnitude, and erring high is the safe direction. Read at call time
 * rather than at module load so a script that populates the environment late
 * still gets the configured values.
 */
const price = (name: string, fallback: number) =>
  Number(process.env[name] ?? fallback);

/** Cost of a chat or vision call, from the usage the API reports back. */
export function chatCostUnits(usage?: {
  prompt_tokens?: number;
  completion_tokens?: number;
} | null): number {
  const input = usage?.prompt_tokens ?? 0;
  const output = usage?.completion_tokens ?? 0;
  const usd =
    (input / 1_000_000) * price("AI_PRICE_INPUT_MTOK", 2.5) +
    (output / 1_000_000) * price("AI_PRICE_OUTPUT_MTOK", 10);
  // Never free: a call that reported no usage still cost something.
  return Math.max(1, Math.round(usd * UNITS_PER_USD));
}

/**
 * Cost of a transcription, estimated from the encoded size.
 *
 * Whisper reports no usage and bills by audio minute, so this works back from
 * bytes at a nominal Opus bitrate. Rounded up: underestimating spend is the
 * failure that matters.
 */
export function transcriptionCostUnits(bytes: number): number {
  const KBPS = 24; // typical browser Opus voice note
  const minutes = bytes / ((KBPS * 1000) / 8) / 60;
  return Math.max(
    1,
    Math.ceil(minutes * price("AI_PRICE_WHISPER_MIN", 0.006) * UNITS_PER_USD),
  );
}
