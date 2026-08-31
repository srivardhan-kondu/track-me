import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  chatCostUnits,
  transcriptionCostUnits,
} from "../src/services/ai/pricing";
import { withRetry } from "../src/services/ai/retry";

/** Shapes the OpenAI SDK's errors, which carry `status` rather than a code. */
function apiError(status: number, headers?: Record<string, string>) {
  return Object.assign(new Error(`HTTP ${status}`), { status, headers });
}

describe("openai retry", () => {
  it("retries a rate limit and returns the eventual success", async () => {
    let calls = 0;
    const result = await withRetry(
      "test",
      async () => {
        calls += 1;
        if (calls < 3) throw apiError(429);
        return "analysed";
      },
      { baseMs: 1, capMs: 2 },
    );

    assert.equal(result, "analysed");
    assert.equal(calls, 3);
  });

  it("gives up after the configured number of attempts", async () => {
    let calls = 0;
    await assert.rejects(
      withRetry(
        "test",
        async () => {
          calls += 1;
          throw apiError(429);
        },
        { attempts: 3, baseMs: 1, capMs: 2 },
      ),
      /HTTP 429/,
    );
    assert.equal(calls, 3);
  });

  it("does not retry a request that will fail identically next time", async () => {
    // A malformed request or a bad key is not worth three round trips.
    for (const status of [400, 401, 403, 404, 422]) {
      let calls = 0;
      await assert.rejects(
        withRetry(
          "test",
          async () => {
            calls += 1;
            throw apiError(status);
          },
          { baseMs: 1, capMs: 2 },
        ),
      );
      assert.equal(calls, 1, `status ${status} should not be retried`);
    }
  });

  it("retries a dropped socket, which carries a code and no status", async () => {
    let calls = 0;
    const result = await withRetry(
      "test",
      async () => {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error("reset"), { code: "ECONNRESET" });
        return "ok";
      },
      { baseMs: 1, capMs: 2 },
    );

    assert.equal(result, "ok");
    assert.equal(calls, 2);
  });

  it("waits no longer than the cap even when the server asks for more", async () => {
    // Retry-After is honoured, but an hour-long wait would outlive the
    // function invocation holding it.
    const started = Date.now();
    let calls = 0;
    await withRetry(
      "test",
      async () => {
        calls += 1;
        if (calls === 1) throw apiError(429, { "retry-after": "3600" });
        return "ok";
      },
      { baseMs: 1, capMs: 30 },
    );

    assert.ok(
      Date.now() - started < 1000,
      "a huge Retry-After must still be clamped to the cap",
    );
  });

  it("returns immediately when nothing goes wrong", async () => {
    let calls = 0;
    const result = await withRetry("test", async () => {
      calls += 1;
      return 42;
    });
    assert.equal(result, 42);
    assert.equal(calls, 1);
  });
});

describe("ai spend accounting", () => {
  it("bills a vision call from the usage the API reports", () => {
    // 2000 in / 500 out at $2.50 and $10.00 per Mtok = $0.010, i.e. 10 units.
    assert.equal(
      chatCostUnits({ prompt_tokens: 2000, completion_tokens: 500 }),
      10,
    );
  });

  it("never bills a call as free, even when usage is missing", () => {
    // A response that reported nothing still cost something; charging zero
    // would let a misbehaving model call run without touching the budget.
    assert.equal(chatCostUnits(undefined), 1);
    assert.equal(chatCostUnits(null), 1);
    assert.equal(chatCostUnits({}), 1);
  });

  it("scales with tokens, so a big image costs more than a small one", () => {
    const small = chatCostUnits({ prompt_tokens: 800, completion_tokens: 200 });
    const large = chatCostUnits({ prompt_tokens: 8000, completion_tokens: 800 });
    assert.ok(large > small, `${large} should exceed ${small}`);
  });

  it("estimates transcription from encoded size", () => {
    // 24 kbps Opus: one minute is 180 KB, at $0.006 = 6 units.
    const oneMinute = (24 * 1000) / 8 * 60;
    assert.equal(transcriptionCostUnits(oneMinute), 6);
  });

  it("rounds transcription up, so short notes are never free", () => {
    assert.ok(transcriptionCostUnits(1) >= 1);
    assert.ok(transcriptionCostUnits(0) >= 1);
  });

  it("keeps a three-minute note far below one vision call", () => {
    // Sanity on the relative weights: audio is the cheap half of a meal.
    const threeMinutes = transcriptionCostUnits(((24 * 1000) / 8) * 180);
    const vision = chatCostUnits({ prompt_tokens: 2000, completion_tokens: 500 });
    assert.ok(
      threeMinutes < vision * 2,
      `transcription ${threeMinutes} should stay in the same order as vision ${vision}`,
    );
  });

  it("prices a typical meal at roughly a cent", () => {
    // The number the daily budget is reasoned about in: at $25/day this is
    // about 1,800 meals before the ceiling.
    const meal =
      chatCostUnits({ prompt_tokens: 1800, completion_tokens: 400 }) +
      transcriptionCostUnits(((24 * 1000) / 8) * 30);
    assert.ok(meal >= 5 && meal <= 25, `expected 5–25 units, got ${meal}`);
  });
});
