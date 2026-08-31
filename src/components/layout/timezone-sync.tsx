"use client";

import * as React from "react";

import { setTimeZone } from "@/app/actions/coach";

/**
 * Reports the browser's timezone once, when it differs from what is stored.
 * Rendered in the dashboard shell so it follows the athlete across devices —
 * logging while travelling updates the zone their days are bucketed in.
 */
export function TimeZoneSync({ current }: { current: string | null }) {
  React.useEffect(() => {
    let detected: string | undefined;
    try {
      detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!detected || detected === current) return;

    void setTimeZone(detected);
  }, [current]);

  return null;
}
