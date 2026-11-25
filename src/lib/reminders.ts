/**
 * When a daily nudge is due, decided without a database or a push service so
 * the rules can be tested on their own.
 *
 * The sender runs hourly and asks this, per athlete, "is it the right local
 * hour, have they not done it yet, and have we not already asked today?"
 * Every answer has to be yes. A reminder for something already done is the
 * fastest way to get notifications turned off for good.
 */

import { dayKeyInZone, hourInZone } from "./tz";

/** Local hour the weigh-in nudge goes out: before breakfast, after waking. */
export const WEIGH_IN_HOUR = 8;
/** Local hour the "nothing logged today" nudge goes out: after dinner. */
export const LOG_HOUR = 20;

export type ReminderKind = "weighIn" | "log";

export type ReminderState = {
  timeZone: string;
  remindWeighIn: boolean;
  remindLog: boolean;
  weighedInToday: boolean;
  loggedToday: boolean;
  weighInNudgedOn: Date | null;
  logNudgedOn: Date | null;
};

const sameDay = (a: Date | null, b: Date) => a !== null && a.getTime() === b.getTime();

export function dueReminders(now: Date, s: ReminderState): ReminderKind[] {
  const hour = hourInZone(now, s.timeZone);
  const today = dayKeyInZone(now, s.timeZone);
  const due: ReminderKind[] = [];

  if (
    hour === WEIGH_IN_HOUR &&
    s.remindWeighIn &&
    !s.weighedInToday &&
    !sameDay(s.weighInNudgedOn, today)
  ) {
    due.push("weighIn");
  }

  if (hour === LOG_HOUR && s.remindLog && !s.loggedToday && !sameDay(s.logNudgedOn, today)) {
    due.push("log");
  }

  return due;
}

export type PushPayload = { title: string; body: string; url: string; tag: string };

export const REMINDER_COPY: Record<ReminderKind, PushPayload> = {
  weighIn: {
    title: "Morning weigh-in",
    body: "Step on the scale before breakfast. It takes five seconds.",
    url: "/dashboard?log=weight",
    tag: "weigh-in",
  },
  log: {
    title: "Nothing logged today",
    body: "A quick voice note covers the whole day. Your coach is counting on it.",
    url: "/dashboard?log=meal",
    tag: "daily-log",
  },
};

/** The first line of a comment, short enough for a lock screen. */
export function commentPreview(body: string, max = 120): string {
  const line = body.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
