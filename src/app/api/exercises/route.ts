import { NextResponse } from "next/server";

import { currentUser } from "@/lib/session";
import { searchCatalog } from "@/services/exercises/resolve";

/** Backs the exercise picker. Catalog data is reference data, not user data. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q") ?? "";
  const results = await searchCatalog(q.slice(0, 60), 30);

  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
