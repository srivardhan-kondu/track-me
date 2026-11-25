import webpush from "web-push";

import { db } from "@/lib/db";
import type { PushPayload } from "@/lib/reminders";

/**
 * Web Push, for reminders and coach comments.
 *
 * Off unless all three VAPID variables are set: without them a browser cannot
 * subscribe and there is nothing to send to, so every screen that would offer
 * notifications hides the offer instead of showing a button that fails.
 */

export function pushEnabled(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT,
  );
}

/** Handed to the browser, which needs it to subscribe. Public by design. */
export function vapidPublicKey(): string | null {
  return pushEnabled() ? process.env.VAPID_PUBLIC_KEY! : null;
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

/**
 * Sends to every device the user has turned notifications on for.
 *
 * A 404 or 410 from the push service means that subscription is gone for
 * good — the app was uninstalled, or permission revoked — so it is deleted
 * rather than retried on every future send. Anything else is logged and left:
 * a reminder that fails to arrive is not worth failing the caller over.
 */
export async function sendPush(userId: string, payload: PushPayload): Promise<number> {
  if (!pushEnabled()) return 0;
  configure();

  const subs = await db.pushSubscription.findMany({ where: { userId } });
  let delivered = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 4 },
        );
        delivered += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.pushSubscription.deleteMany({ where: { id: sub.id } });
        } else {
          console.error("[push] send failed", status ?? err);
        }
      }
    }),
  );

  return delivered;
}
