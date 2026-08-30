import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";

/**
 * Status of the caller's in-flight AI jobs. The client polls this after an
 * upload and refreshes the timeline once nothing is pending.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [meals, workouts] = await Promise.all([
    db.meal.findMany({
      where: { userId: user.id, status: { in: ["PENDING", "PROCESSING"] } },
      select: { id: true },
    }),
    db.workout.findMany({
      where: { userId: user.id, status: { in: ["PENDING", "PROCESSING"] } },
      select: { id: true },
    }),
  ]);

  return NextResponse.json(
    {
      pending: meals.length + workouts.length,
      mealIds: meals.map((m) => m.id),
      workoutIds: workouts.map((w) => w.id),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
