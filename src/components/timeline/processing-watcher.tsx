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
export function ProcessingWatcher({ initialPending }: { initialPending: number }) {
  const router = useRouter();
  const [session, setSession] = React.useState<number | null>(() =>
    initialPending > 0 ? Date.now() : null,
  );

  React.useEffect(() => {
    // Start a session when the server reports new work and none is running.
    if (initialPending > 0) setSession((current) => current ?? Date.now());
  }, [initialPending]);

  const { data } = useQuery({
    queryKey: ["processing", session],
    queryFn: async () => {
      const res = await fetch("/api/processing", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to check processing status");
      return (await res.json()) as { pending: number };
    },
    enabled: session !== null,
    refetchInterval: 2000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 0,
    // A suspended database can make one poll fail; keep watching.
    retry: 3,
  });

  React.useEffect(() => {
    if (session === null || data === undefined) return;

    if (data.pending === 0) {
      setSession(null);
      // Pull the finished macros into the timeline.
      router.refresh();
    }
  }, [data, session, router]);

  return null;
}
