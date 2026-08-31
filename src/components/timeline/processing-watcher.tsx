"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

/**
 * Meal and workout analysis runs after the upload response is sent, so the
 * timeline has to learn when it lands.
 *
 * `initialPending` comes from the server render and changes when a new upload
 * is made, so polling is driven by a state that re-arms on that change —
 * relying on the query's own cached data would leave a page that was loaded
 * with nothing pending stuck on "Analysing" forever.
 */
export function ProcessingWatcher({ initialPending }: { initialPending: number }) {
  const router = useRouter();
  const [watching, setWatching] = React.useState(initialPending > 0);

  React.useEffect(() => {
    if (initialPending > 0) setWatching(true);
  }, [initialPending]);

  const { data } = useQuery({
    queryKey: ["processing"],
    queryFn: async () => {
      const res = await fetch("/api/processing", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to check processing status");
      return (await res.json()) as { pending: number };
    },
    enabled: watching,
    refetchInterval: watching ? 2000 : false,
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 0,
  });

  React.useEffect(() => {
    if (!watching || data === undefined) return;

    if (data.pending === 0) {
      setWatching(false);
      // Pull the finished macros into the timeline.
      router.refresh();
    }
  }, [data, watching, router]);

  return null;
}
