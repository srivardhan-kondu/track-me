import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { readMealItems } from "@/lib/meal-items";
import { enforce, rateLimitResponse, RateLimited } from "@/lib/rate-limit";
import { currentUser } from "@/lib/session";

/**
 * One meal's analysis, for the review step that opens after logging.
 *
 * `/api/processing` only reports how many jobs are outstanding; the review
 * table needs the result itself, which is what this returns. Scoped to the
 * owner — a coach reads meals through the timeline, not through here.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await enforce("processing", user.id, "Too many status checks.");
  } catch (err) {
    if (err instanceof RateLimited) return rateLimitResponse(err);
    throw err;
  }

  const { id } = await params;

  const meal = await db.meal.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      error: true,
      title: true,
      slot: true,
      transcript: true,
      items: true,
      calories: true,
      protein: true,
      carbs: true,
      fat: true,
    },
  });

  if (!meal || meal.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { userId: _omit, items, ...rest } = meal;

  return NextResponse.json(
    { ...rest, items: readMealItems(items) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
