import { NextResponse } from "next/server";

import { cronAuthorized } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { dueReminders, REMINDER_COPY, type ReminderKind } from "@/lib/reminders";
import { dayKeyInZone, safeZone, startOfDayInZone } from "@/lib/tz";
import { pushEnabled, sendPush } from "@/services/push";

/**
 * Sends the morning weigh-in and evening "nothing logged" nudges.
 *
 * Called hourly, because "8 in the morning" happens at a different UTC hour
 * for every timezone. Vercel's Hobby plan allows only daily crons, so the
 * hourly call comes from a GitHub Actions schedule
 * (.github/workflows/reminders.yml) carrying the same CRON_SECRET the job
 * queue uses.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!pushEnabled()) {
    return NextResponse.json({ sent: 0, skipped: "VAPID keys not configured" });
  }

  const now = new Date();

  // Only athletes who can receive anything, and who want at least one nudge.
  const candidates = await db.user.findMany({
    where: {
      role: "ATHLETE",
      pushSubscriptions: { some: {} },
      OR: [{ remindWeighIn: true }, { remindLog: true }],
    },
    select: {
      id: true,
      timeZone: true,
      remindWeighIn: true,
      remindLog: true,
      weighInNudgedOn: true,
      logNudgedOn: true,
    },
  });

  let sent = 0;
  for (const user of candidates) {
    const zone = safeZone(user.timeZone);
    const today = dayKeyInZone(now, zone);
    const since = startOfDayInZone(now, zone);

    // Cheap first pass: most users are not at either hour right now, and
    // they need no queries at all.
    const possible = dueReminders(now, {
      timeZone: zone,
      remindWeighIn: user.remindWeighIn,
      remindLog: user.remindLog,
      weighedInToday: false,
      loggedToday: false,
      weighInNudgedOn: user.weighInNudgedOn,
      logNudgedOn: user.logNudgedOn,
    });
    if (possible.length === 0) continue;

    const [weight, meal, workout] = await Promise.all([
      db.weightEntry.findUnique({
        where: { userId_day: { userId: user.id, day: today } },
        select: { id: true },
      }),
      db.meal.findFirst({ where: { userId: user.id, eatenAt: { gte: since } }, select: { id: true } }),
      db.workout.findFirst({
        where: { userId: user.id, performedAt: { gte: since } },
        select: { id: true },
      }),
    ]);

    const due: ReminderKind[] = dueReminders(now, {
      timeZone: zone,
      remindWeighIn: user.remindWeighIn,
      remindLog: user.remindLog,
      weighedInToday: Boolean(weight),
      loggedToday: Boolean(meal || workout),
      weighInNudgedOn: user.weighInNudgedOn,
      logNudgedOn: user.logNudgedOn,
    });

    for (const kind of due) {
      // Stamp first: a send that half-fails must not be repeated next run.
      await db.user.update({
        where: { id: user.id },
        data: kind === "weighIn" ? { weighInNudgedOn: today } : { logNudgedOn: today },
      });
      sent += (await sendPush(user.id, REMINDER_COPY[kind])) > 0 ? 1 : 0;
    }
  }

  return NextResponse.json(
    { candidates: candidates.length, sent },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const POST = GET;
