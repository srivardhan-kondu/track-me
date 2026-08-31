import { NextResponse } from "next/server";

import { assertCanViewAthlete, currentUser } from "@/lib/session";
import { getObject, isSafeKey, usingObjectStorage } from "@/services/storage";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  webm: "audio/webm",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
};

/**
 * Serves locally-stored uploads in development. With object storage configured
 * the provider signs its own URLs, so this route is not part of the media path.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (usingObjectStorage) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key: segments } = await params;
  const key = segments.join("/");

  if (!isSafeKey(key)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Keys are built as "<kind>/<userId>/<stamp>/<uuid>.<ext>", so the owner is
  // in the key. This used to serve any key to any signed-in user on the
  // grounds that the UUID was unguessable — but the keys are not secret: the
  // export hands them back in plaintext, and an unguessable identifier is not
  // an access control. Same rule as every other read of someone's data.
  const ownerId = key.split("/")[1];
  if (!ownerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await assertCanViewAthlete(user.id, ownerId);
  } catch {
    // 404 rather than 403: whether a key exists is itself worth not saying.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await getObject(key);
    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Length": String(body.byteLength),
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
