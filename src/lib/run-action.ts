"use client";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

/**
 * Calls a server action, turning a thrown error into a normal failed result.
 *
 * Actions reject rather than return when something fails outside their own
 * logic — a dropped connection, a suspended serverless database waking up, a
 * deploy swapping out mid-request. An uncaught rejection skips whatever
 * follows the await, which previously left submit buttons spinning forever.
 */
export async function runAction(
  run: () => Promise<ActionResult>,
): Promise<ActionResult> {
  try {
    return await run();
  } catch {
    return {
      ok: false,
      error: "Couldn't reach the server. Check your connection and try again.",
    };
  }
}
