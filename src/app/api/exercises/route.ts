import { NextResponse } from "next/server";

import { enforce, rateLimitResponse, RateLimited } from "@/lib/rate-limit";
import { currentUser } from "@/lib/session";
import { browseCatalog } from "@/services/exercises/resolve";

/** Backs the exercise picker. Catalog data is reference data, not user data. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The picker queries as the athlete types.
  try {
    await enforce("exercises", user.id, "Too many searches.");
  } catch (err) {
    if (err instanceof RateLimited) return rateLimitResponse(err);
    throw err;
  }

  const q = new URL(req.url).searchParams.get("q") ?? "";
  const groups = await browseCatalog(q.slice(0, 60));

  return NextResponse.json(
    { groups },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
