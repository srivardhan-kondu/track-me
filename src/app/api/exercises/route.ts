import { NextResponse } from "next/server";

import { currentUser } from "@/lib/session";
import { browseCatalog } from "@/services/exercises/resolve";

/** Backs the exercise picker. Catalog data is reference data, not user data. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q") ?? "";
  const groups = await browseCatalog(q.slice(0, 60));

  return NextResponse.json(
    { groups },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
