import { NextResponse } from "next/server";

import { currentUser } from "@/lib/session";
import { getObject, isSafeKey, usingR2 } from "@/services/storage";

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
 * Serves locally-stored uploads in development. In production R2 signs its own
 * URLs, so this route is not part of the media path.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (usingR2) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Any signed-in user may read media; object keys are unguessable UUIDs.
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key: segments } = await params;
  const key = segments.join("/");

  if (!isSafeKey(key)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
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
