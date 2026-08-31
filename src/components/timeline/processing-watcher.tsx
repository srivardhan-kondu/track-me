"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

/**
 * Meal and workout analysis runs after the upload response is sent, so the
 * timeline has to learn when it lands.
 *
 * Each watching session gets its own query key. Without that, the result of a
 * previous session ({ pending: 0 }) is still in the cache when the next upload
 * arrives, and the completion check fires against that stale value before the
 * first request goes out — the watcher disarms immediately and the card sits
 * on "Analysing" forever. That is why the first upload on a page worked and
 * every one after it did not.
 */
/** First interval, doubled on each poll. */
const BASE_INTERVAL_MS = 2000;
/** Never wait longer than this between polls. */
const MAX_INTERVAL_MS = 30_000;
/**
 * Give up after roughly five minutes of backed-off polling. A job that has not
 * landed by then is queued for a retry that will take minutes more, and a page
 * left open overnight must not keep asking.
 */
const MAX_POLLS = 20;

export function ProcessingWatcher({ initialPending }: { initialPending: number }) {
  const router = useRouter();
  const [session, setSession] = React.useState<number | null>(() =>
    initialPending > 0 ? Date.now() : null,
  );
  const [polls, setPolls] = React.useState(0);

  React.useEffect(() => {
    // Start a session when the server reports new work and none is running.
    if (initialPending > 0) {
      setSession((current) => {
        if (current !== null) return current;
        setPolls(0);
        return Date.now();
      });
    }
  }, [initialPending]);

  const { data } = useQuery({
    queryKey: ["processing", session],
    queryFn: async () => {
      const res = await fetch("/api/processing", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to check processing status");
      setPolls((n) => n + 1);
      return (await res.json()) as { pending: number };
    },
    enabled: session !== null,
    /**
     * Backs off rather than hammering a fixed 2s.
     *
     * At a fixed interval, every client watching an upload costs half a
     * request per second for as long as it waits — and the old version never
     * stopped, so a job that died left the tab polling for ever. Doubling to a
     * 30s ceiling keeps the first few seconds feeling immediate (which is when
     * most jobs land) while cutting the tail by an order of magnitude.
     */
    refetchInterval: () =>
      Math.min(MAX_INTERVAL_MS, BASE_INTERVAL_MS * 2 ** Math.min(polls, 5)),
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 0,
    // A suspended database can make one poll fail; keep watching.
    retry: 3,
  });

  React.useEffect(() => {
    if (session === null) return;

    // Stop asking. The work is queued and will finish; the next navigation or
    // refresh picks it up.
    if (polls >= MAX_POLLS) {
      setSession(null);
      router.refresh();
      return;
    }

    if (data?.pending === 0) {
      setSession(null);
      // Pull the finished macros into the timeline.
      router.refresh();
    }
  }, [data, session, polls, router]);

  return null;
}
