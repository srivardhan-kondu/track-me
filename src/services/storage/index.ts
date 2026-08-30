import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Object storage for meal images, progress photos and voice notes.
 *
 * Production uses Cloudflare R2 (S3-compatible, no egress fees). When R2 env
 * vars are absent the driver falls back to the local filesystem so the app is
 * fully runnable in development without cloud credentials.
 */

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

/**
 * Optional endpoint override. Any S3-compatible store works here — Supabase
 * Storage, Backblaze B2, MinIO, plain S3 — so the deployment is not tied to
 * Cloudflare. Left unset, the endpoint is derived from R2_ACCOUNT_ID.
 */
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_REGION = process.env.S3_REGION || "auto";

function endpoint(): string | undefined {
  if (S3_ENDPOINT) return S3_ENDPOINT.replace(/\/$/, "");
  if (R2_ACCOUNT_ID) return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return undefined;
}

/** True once a bucket, credentials and a reachable endpoint are all present. */
export const usingObjectStorage = Boolean(
  R2_ACCESS_KEY_ID &&
    R2_SECRET_ACCESS_KEY &&
    R2_BUCKET &&
    (R2_ACCOUNT_ID || S3_ENDPOINT),
);

/** Name of the configured provider, for the settings screen. */
export const storageProvider = !usingObjectStorage
  ? "local filesystem"
  : S3_ENDPOINT
    ? new URL(S3_ENDPOINT).hostname
    : "Cloudflare R2";

const LOCAL_ROOT = path.join(process.cwd(), ".uploads");

/**
 * The local driver writes to the working directory, which on a serverless host
 * is read-only and discarded between invocations. Fail with an actionable
 * message rather than surfacing an opaque EROFS at upload time.
 */
function assertStorageUsable() {
  if (!usingObjectStorage && process.env.NODE_ENV === "production") {
    throw new Error(
      "Object storage is not configured. Set R2_ACCESS_KEY_ID, " +
        "R2_SECRET_ACCESS_KEY, R2_BUCKET and either R2_ACCOUNT_ID (Cloudflare " +
        "R2) or S3_ENDPOINT (any S3-compatible store) — local filesystem " +
        "storage cannot be used in production.",
    );
  }
}

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: S3_REGION,
      endpoint: endpoint(),
      // Path-style keeps non-AWS providers working regardless of DNS setup.
      forcePathStyle: true,
      // Recent SDK versions attach checksum headers to every request, which
      // several S3-compatible implementations (R2, Neon, Supabase) reject.
      requestChecksumCalculation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
};

/** Builds a collision-free, user-scoped object key. */
export function buildKey(
  userId: string,
  kind: "meal" | "workout" | "weight" | "progress",
  contentType: string,
): string {
  const ext = EXT[contentType.split(";")[0].trim()] ?? "bin";
  const d = new Date();
  const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${kind}/${userId}/${stamp}/${randomUUID()}.${ext}`;
}

/** Guards against path traversal in keys handed back to the local media route. */
export function isSafeKey(key: string): boolean {
  return (
    key.length > 0 &&
    !key.startsWith("/") &&
    !key.includes("..") &&
    !key.includes("\\") &&
    /^[A-Za-z0-9/_.-]+$/.test(key)
  );
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  assertStorageUsable();
  if (!isSafeKey(key)) throw new Error("Unsafe storage key");

  if (usingObjectStorage) {
    await s3().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET!,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  const dest = path.join(LOCAL_ROOT, key);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, body);
  return key;
}

export async function getObject(key: string): Promise<Buffer> {
  if (!isSafeKey(key)) throw new Error("Unsafe storage key");

  if (usingObjectStorage) {
    const res = await s3().send(
      new GetObjectCommand({ Bucket: R2_BUCKET!, Key: key }),
    );
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  return readFile(path.join(LOCAL_ROOT, key));
}

export async function deleteObject(key: string): Promise<void> {
  if (!isSafeKey(key)) return;
  try {
    if (usingObjectStorage) {
      await s3().send(
        new DeleteObjectCommand({ Bucket: R2_BUCKET!, Key: key }),
      );
    } else {
      await unlink(path.join(LOCAL_ROOT, key));
    }
  } catch {
    // Deleting media is best-effort; a missing object is not an error.
  }
}

/**
 * A browser-usable URL for an object. Public CDN base when configured,
 * otherwise a short-lived presigned URL, otherwise the local media route.
 */
export async function mediaUrl(
  key: string | null | undefined,
): Promise<string | null> {
  if (!key || !isSafeKey(key)) return null;

  if (usingObjectStorage) {
    if (R2_PUBLIC_BASE_URL) {
      return `${R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
    }
    return getSignedUrl(
      s3(),
      new GetObjectCommand({ Bucket: R2_BUCKET!, Key: key }),
      { expiresIn: 3600 },
    );
  }

  return `/api/media/${key}`;
}
