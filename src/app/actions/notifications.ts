"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

import type { ActionResult } from "./meals";

const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

/**
 * Stores this device's push subscription. Keyed on the endpoint, so a device
 * that re-subscribes — or changes hands between two accounts — updates its row
 * rather than leaving a stale one that would notify the previous owner.
 */
export async function savePushSubscription(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = SubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That subscription could not be read." };

  const { endpoint, keys } = parsed.data;
  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth },
  });

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

/** Forgets this device. Only ever the caller's own row. */
export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const user = await requireUser();
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

const PrefSchema = z.enum(["remindWeighIn", "remindLog", "remindComments"]);

export async function setReminderPref(pref: string, on: boolean): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = PrefSchema.safeParse(pref);
  if (!parsed.success) return { ok: false, error: "Unknown reminder." };

  await db.user.update({
    where: { id: user.id },
    data: { [parsed.data]: Boolean(on) },
  });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
