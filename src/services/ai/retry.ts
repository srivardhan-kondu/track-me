/**
 * Retry with exponential backoff for the OpenAI calls.
 *
 * Without this a 429 propagates straight out of `analyzeMeal`, the caller
 * writes `status: "FAILED"`, and the athlete is told their meal could not be
 * analysed — because somebody else was uploading at the same time. Vision
 * payloads are one to two thousand tokens each, so the tokens-per-minute
 * ceiling is reached well before the requests-per-minute one, and at any real
 * concurrency that is a routine event rather than an exceptional one.
 */

/** Transport and server faults worth another attempt. */
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function statusOf(err: unknown): number | null {
  const status = (err as { status?: unknown })?.status;
  return typeof status === "number" ? status : null;
}

function isRetryable(err: unknown): boolean {
  const status = statusOf(err);
  if (status !== null) return RETRYABLE_STATUS.has(status);
  // A dropped socket surfaces as a plain Error with a code, not a status.
  const code = (err as { code?: unknown })?.code;
  return code === "ECONNRESET" || code === "ETIMEDOUT" || code === "EPIPE";
}

/**
 * Honours `Retry-After` when the API sends one — it knows when the window
 * reopens and we are only guessing.
 */
function serverDelay(err: unknown): number | null {
  const headers = (err as { headers?: Record<string, string> })?.headers;
  const raw = headers?.["retry-after"] ?? headers?.["Retry-After"];
  if (!raw) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type RetryOptions = {
  attempts?: number;
  /** First backoff, doubled each attempt. */
  baseMs?: number;
  /** Never wait longer than this between attempts. */
  capMs?: number;
};

export async function withRetry<T>(
  label: string,
  run: () => Promise<T>,
  { attempts = 3, baseMs = 1000, capMs = 20_000 }: RetryOptions = {},
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await run();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === attempts) throw err;

      const backoff = Math.min(capMs, baseMs * 2 ** (attempt - 1));
      // Full jitter: without it, everything rate-limited in the same second
      // retries in the same second and the spike simply repeats.
      const jittered = Math.round(Math.random() * backoff);
      const wait = serverDelay(err) ?? jittered;

      console.warn(
        `[ai] ${label} attempt ${attempt}/${attempts} failed` +
          `${statusOf(err) ? ` (${statusOf(err)})` : ""}; retrying in ${wait}ms`,
      );
      await sleep(Math.min(wait, capMs));
    }
  }

  throw lastError;
}
