import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildKey, isSafeKey, putObject } from "../src/services/storage";

describe("storage keys", () => {
  it("scopes keys to the user and record type", () => {
    const key = buildKey("user123", "meal", "image/jpeg");
    assert.match(key, /^meal\/user123\/\d{6}\/[0-9a-f-]{36}\.jpg$/);
  });

  it("maps content types to sensible extensions", () => {
    assert.ok(buildKey("u", "meal", "audio/webm").endsWith(".webm"));
    assert.ok(buildKey("u", "progress", "image/png").endsWith(".png"));
    assert.ok(buildKey("u", "meal", "application/x-evil").endsWith(".bin"));
  });

  it("generates unique keys", () => {
    const a = buildKey("u", "meal", "image/jpeg");
    const b = buildKey("u", "meal", "image/jpeg");
    assert.notEqual(a, b);
  });

  it("rejects traversal and absolute paths", () => {
    assert.equal(isSafeKey("meal/u/202601/a.jpg"), true);
    assert.equal(isSafeKey("../../etc/passwd"), false);
    assert.equal(isSafeKey("/etc/passwd"), false);
    assert.equal(isSafeKey("meal/../../secret"), false);
    assert.equal(isSafeKey("meal\\u\\a.jpg"), false);
    assert.equal(isSafeKey(""), false);
  });
});

describe("production storage guard", () => {
  it("refuses local filesystem writes in production", async () => {
    // Serverless filesystems are read-only, so this must fail with an
    // actionable message rather than an opaque EROFS at upload time.
    const env = process.env as Record<string, string | undefined>;
    const original = env.NODE_ENV;
    env.NODE_ENV = "production";

    try {
      await assert.rejects(
        () =>
          putObject(
            buildKey("u", "meal", "image/jpeg"),
            Buffer.from("x"),
            "image/jpeg",
          ),
        /Object storage is not configured/,
      );
    } finally {
      env.NODE_ENV = original;
    }
  });

  it("allows local writes outside production", async () => {
    const key = buildKey("testuser", "meal", "image/jpeg");
    await assert.doesNotReject(() =>
      putObject(key, Buffer.from("test"), "image/jpeg"),
    );
  });
});
