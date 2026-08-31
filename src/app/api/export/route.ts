import { NextResponse } from "next/server";

import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { enforce, rateLimitResponse, RateLimited } from "@/lib/rate-limit";
import { currentUser, premiumStatus } from "@/lib/session";

/**
 * Takes your data out.
 *
 * JSON by default, which is complete and machine-readable; CSV per entity for
 * anyone who wants to open it in a spreadsheet, which in practice is most
 * people. Photographs are referenced by storage key rather than by URL — the
 * URLs the app serves are deliberately short-lived, so baking them into an
 * export would produce a file full of dead links within the hour.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = ["workouts", "meals", "weights", "water"] as const;
type Entity = (typeof TYPES)[number];

/**
 * Rows per entity in a single export.
 *
 * The queries used to be unbounded, which on a long-lived account meant five
 * full table reads serialised into memory inside a function with a 60-second
 * ceiling. Anyone past this cap is told so rather than handed a truncated file
 * that looks complete.
 */
const MAX_ROWS = 5000;

function filename(base: string, ext: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `track-me-${base}-${stamp}.${ext}`;
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { premium } = await premiumStatus(user.id);
  if (!premium) {
    return NextResponse.json(
      { error: "Data export is part of Premium" },
      { status: 403 },
    );
  }

  // Five table reads and a full serialisation. Premium gates who can ask;
  // this gates how often.
  try {
    await enforce("export", user.id, "You have exported your data a few times already.");
  } catch (err) {
    if (err instanceof RateLimited) return rateLimitResponse(err);
    throw err;
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const type = url.searchParams.get("type") as Entity | null;

  const [meals, workouts, weights, water, photos, profile] = await Promise.all([
    db.meal.findMany({
      where: { userId: user.id },
      orderBy: { eatenAt: "asc" },
      take: MAX_ROWS + 1,
      select: {
        eatenAt: true,
        slot: true,
        title: true,
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
        transcript: true,
      },
    }),
    db.workout.findMany({
      where: { userId: user.id },
      orderBy: { performedAt: "asc" },
      take: MAX_ROWS + 1,
      select: {
        performedAt: true,
        title: true,
        durationMin: true,
        transcript: true,
        exercises: {
          orderBy: { position: "asc" },
          select: { name: true, sets: true, reps: true, weightKg: true },
        },
      },
    }),
    db.weightEntry.findMany({
      where: { userId: user.id },
      orderBy: { day: "asc" },
      take: MAX_ROWS + 1,
      select: { day: true, weightKg: true, notes: true, photoKey: true },
    }),
    db.waterEntry.findMany({
      where: { userId: user.id },
      orderBy: { day: "asc" },
      take: MAX_ROWS + 1,
      select: { day: true, ml: true },
    }),
    db.progressPhoto.findMany({
      where: { userId: user.id },
      orderBy: { takenAt: "asc" },
      take: MAX_ROWS + 1,
      select: { takenAt: true, pose: true, imageKey: true },
    }),
    db.user.findUnique({
      where: { id: user.id },
      select: {
        name: true,
        email: true,
        heightCm: true,
        waterGoalMl: true,
        timeZone: true,
        createdAt: true,
      },
    }),
  ]);

  // Say so rather than handing back a file that looks complete but is not.
  const truncated =
    meals.length > MAX_ROWS ||
    workouts.length > MAX_ROWS ||
    weights.length > MAX_ROWS ||
    water.length > MAX_ROWS ||
    photos.length > MAX_ROWS;

  if (truncated) {
    return NextResponse.json(
      {
        error:
          "Your history is too large to export in one request. Email support " +
          "and we will send you the full archive.",
      },
      { status: 413 },
    );
  }

  if (format === "csv") {
    if (!type || !TYPES.includes(type)) {
      return NextResponse.json(
        { error: `CSV needs ?type= one of ${TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    let rows: Record<string, unknown>[];
    if (type === "meals") {
      rows = meals;
    } else if (type === "weights") {
      rows = weights;
    } else if (type === "water") {
      rows = water;
    } else {
      // One row per exercise, so the file is usable in a spreadsheet: a
      // session with four movements becomes four rows sharing a date.
      rows = workouts.flatMap<Record<string, unknown>>((w) =>
        w.exercises.length === 0
          ? [
              {
                performedAt: w.performedAt,
                title: w.title,
                durationMin: w.durationMin,
                exercise: "",
                sets: null,
                reps: null,
                weightKg: null,
              },
            ]
          : w.exercises.map((e) => ({
              performedAt: w.performedAt,
              title: w.title,
              durationMin: w.durationMin,
              exercise: e.name,
              sets: e.sets,
              reps: e.reps,
              weightKg: e.weightKg,
            })),
      );
    }

    return new NextResponse(toCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename(type, "csv")}"`,
        "cache-control": "no-store",
      },
    });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    profile,
    counts: {
      meals: meals.length,
      workouts: workouts.length,
      weighIns: weights.length,
      waterDays: water.length,
      progressPhotos: photos.length,
    },
    meals,
    workouts,
    weights,
    water,
    progressPhotos: photos,
  };

  // Not pretty-printed: indentation is pure size on a payload no human reads
  // by eye, and this is built in memory before a byte goes out.
  return new NextResponse(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename("export", "json")}"`,
      "cache-control": "no-store",
    },
  });
}
