import { cache } from "react";

import { db } from "@/lib/db";
import { METRIC, unitPrefs, type UnitPrefs } from "@/lib/units";

/**
 * The units a given athlete reads their numbers in.
 *
 * Wrapped in React's `cache` so the several server components that need it
 * during one render — the page, its rail, the chart beside it — cost a single
 * query between them rather than one each.
 *
 * Takes a user id rather than reading the session, because the coach's screens
 * ask this about somebody else: an athlete's log is shown in the athlete's own
 * units, as their days are already shown in their own timezone.
 */
export const getUnits = cache(async (userId: string): Promise<UnitPrefs> => {
  const row = await db.user.findUnique({
    where: { id: userId },
    select: { weightUnit: true, heightUnit: true, volumeUnit: true },
  });
  return row ? unitPrefs(row) : METRIC;
});
