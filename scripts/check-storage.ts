/**
 * Verifies object storage end to end: upload, read back, presign, fetch over
 * HTTP, delete. Run after configuring a bucket:
 *
 *   npm run check:storage
 */
import { randomUUID } from "node:crypto";

import {
  buildKey,
  deleteObject,
  getObject,
  mediaUrl,
  putObject,
  storageProvider,
  usingObjectStorage,
} from "../src/services/storage";

function line(ok: boolean, label: string, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  console.log("\nObject storage check");
  console.log(`  provider   ${storageProvider}`);
  console.log(`  configured ${usingObjectStorage}`);
  console.log(`  bucket     ${process.env.R2_BUCKET ?? "(unset)"}\n`);

  if (!usingObjectStorage) {
    console.error(
      "No object storage configured — set R2_BUCKET, the key pair, and either\nR2_ACCOUNT_ID or S3_ENDPOINT.\n",
    );
    process.exit(1);
  }

  const payload = Buffer.from(`track me storage check ${randomUUID()}`);
  const key = buildKey("healthcheck", "meal", "image/jpeg");

  const t0 = Date.now();
  await putObject(key, payload, "image/jpeg");
  line(true, "upload", `${Date.now() - t0}ms`);

  const fetched = await getObject(key);
  line(fetched.equals(payload), "read back matches", `${fetched.byteLength} bytes`);

  const url = await mediaUrl(key);
  line(Boolean(url), "presigned URL issued");

  if (url?.startsWith("http")) {
    const res = await fetch(url);
    const body = Buffer.from(await res.arrayBuffer());
    line(res.ok, "HTTP fetch of presigned URL", `${res.status}`);
    line(body.equals(payload), "fetched bytes match");
  }

  await deleteObject(key);
  let gone = false;
  try {
    await getObject(key);
  } catch {
    gone = true;
  }
  line(gone, "delete removes the object");

  console.log("");
}

main().catch((err) => {
  console.error("\nFAILED:", (err as Error).message, "\n");
  process.exit(1);
});
