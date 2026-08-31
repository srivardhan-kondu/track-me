"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { readUpload } from "@/lib/uploads";
import { dayKeyInZone, safeZone } from "@/lib/tz";
import { buildKey, deleteObject, putObject } from "@/services/storage";

import type { ActionResult } from "./meals";

const WeightSchema = z.object({
  weightKg: z.coerce.number().min(20).max(400),
  notes: z.string().max(500).optional(),
  day: z.string().optional(),
});

/**
 * Records the morning check-in. One entry per calendar day — logging again
 * updates that day rather than creating a duplicate.
 */
export async function logWeight(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = WeightSchema.safeParse({
    weightKg: formData.get("weightKg"),
    notes: formData.get("notes")?.toString() || undefined,
    day: formData.get("day")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Enter a weight between 20 and 400 kg." };
  }

  let photo;
  try {
    photo = await readUpload(formData.get("photo"), "image");
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  // An explicit YYYY-MM-DD is already a calendar date, so it becomes the
  // bucket directly; "today" is resolved in the athlete's own zone.
  let day: Date;
  if (parsed.data.day && /^\d{4}-\d{2}-\d{2}$/.test(parsed.data.day)) {
    const [y, m, d] = parsed.data.day.split("-").map(Number);
    day = new Date(Date.UTC(y, m - 1, d));
  } else {
    day = dayKeyInZone(new Date(), safeZone(user.timeZone));
  }
  if (Number.isNaN(day.getTime())) {
    return { ok: false, error: "Invalid date." };
  }

  let photoKey: string | null = null;
  if (photo) {
    try {
      photoKey = buildKey(user.id, "weight", photo.contentType);
      await putObject(photoKey, photo.buffer, photo.contentType);
    } catch {
      return { ok: false, error: "Photo upload failed." };
    }
  }

  const existing = await db.weightEntry.findUnique({
    where: { userId_day: { userId: user.id, day } },
    select: { photoKey: true },
  });

  await db.weightEntry.upsert({
    where: { userId_day: { userId: user.id, day } },
    create: {
      userId: user.id,
      day,
      weightKg: parsed.data.weightKg,
      notes: parsed.data.notes?.trim() || null,
      photoKey,
    },
    update: {
      weightKg: parsed.data.weightKg,
      notes: parsed.data.notes?.trim() || null,
      // Keep the previous photo when this check-in did not include one.
      ...(photoKey ? { photoKey } : {}),
    },
  });

  if (photoKey && existing?.photoKey) {
    await deleteObject(existing.photoKey);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/weight");
  return { ok: true };
}

export async function deleteWeightEntry(id: string): Promise<ActionResult> {
  const user = await requireUser();

  const entry = await db.weightEntry.findUnique({
    where: { id },
    select: { userId: true, photoKey: true },
  });
  if (!entry || entry.userId !== user.id) {
    return { ok: false, error: "Entry not found." };
  }

  await db.weightEntry.delete({ where: { id } });
  if (entry.photoKey) await deleteObject(entry.photoKey);

  revalidatePath("/dashboard/weight");
  return { ok: true };
}

const PhotoSchema = z.object({
  pose: z.enum(["FRONT", "SIDE", "BACK"]),
  takenAt: z.string().optional(),
});

/** Uploads a progress photo for one pose. */
export async function uploadProgressPhoto(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = PhotoSchema.safeParse({
    pose: formData.get("pose"),
    takenAt: formData.get("takenAt")?.toString() || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Choose a pose: front, side or back." };
  }

  let photo;
  try {
    photo = await readUpload(formData.get("photo"), "image");
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  if (!photo) return { ok: false, error: "Select a photo to upload." };

  const takenAt = parsed.data.takenAt
    ? new Date(parsed.data.takenAt)
    : new Date();
  if (Number.isNaN(takenAt.getTime())) {
    return { ok: false, error: "Invalid date." };
  }

  const imageKey = buildKey(user.id, "progress", photo.contentType);
  try {
    await putObject(imageKey, photo.buffer, photo.contentType);
  } catch {
    return { ok: false, error: "Photo upload failed." };
  }

  await db.progressPhoto.create({
    data: { userId: user.id, pose: parsed.data.pose, imageKey, takenAt },
  });

  revalidatePath("/dashboard/progress");
  return { ok: true };
}

export async function deleteProgressPhoto(
  id: string,
): Promise<ActionResult> {
  const user = await requireUser();

  const photo = await db.progressPhoto.findUnique({
    where: { id },
    select: { userId: true, imageKey: true },
  });
  if (!photo || photo.userId !== user.id) {
    return { ok: false, error: "Photo not found." };
  }

  await db.progressPhoto.delete({ where: { id } });
  await deleteObject(photo.imageKey);

  revalidatePath("/dashboard/progress");
  return { ok: true };
}
