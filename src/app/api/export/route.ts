import { NextResponse } from "next/server";

import { db } from "@/lib/db";
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

const TYPES = ["workouts", "meals", "weights"] as const;
type Entity = (typeof TYPES)[number];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = value instanceof Date ? value.toISOString() : String(value);
  // Quote anything that would otherwise break the row apart.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(","));
  }
  return lines.join("\n");
}

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

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const type = url.searchParams.get("type") as Entity | null;

  const [meals, workouts, weights, photos, profile] = await Promise.all([
    db.meal.findMany({
      where: { userId: user.id },
      orderBy: { eatenAt: "asc" },
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
      select: { day: true, weightKg: true, notes: true, photoKey: true },
    }),
    db.progressPhoto.findMany({
      where: { userId: user.id },
      orderBy: { takenAt: "asc" },
      select: { takenAt: true, pose: true, imageKey: true },
    }),
    db.user.findUnique({
      where: { id: user.id },
      select: {
        name: true,
        email: true,
        heightCm: true,
        timeZone: true,
        createdAt: true,
      },
    }),
  ]);

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
      progressPhotos: photos.length,
    },
    meals,
    workouts,
    weights,
    progressPhotos: photos,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename("export", "json")}"`,
      "cache-control": "no-store",
    },
  });
}
