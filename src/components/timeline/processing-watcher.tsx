"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

/**
 * Meal and workout analysis runs after the upload response is sent, so the
 * timeline needs to learn when it lands. Polls only while work is outstanding.
 */
export function ProcessingWatcher({ initialPending }: { initialPending: number }) {
  const router = useRouter();
  const previous = React.useRef(initialPending);

  const { data } = useQuery({
    queryKey: ["processing"],
    queryFn: async () => {
      const res = await fetch("/api/processing", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to check processing status");
      return (await res.json()) as { pending: number };
    },
    initialData: { pending: initialPending },
    // Back off to nothing once every job has settled.
    refetchInterval: (query) =>
      (query.state.data?.pending ?? 0) > 0 ? 2500 : false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  React.useEffect(() => {
    const pending = data?.pending ?? 0;
    if (previous.current > 0 && pending === 0) {
      router.refresh();
    }
    previous.current = pending;
  }, [data?.pending, router]);

  return null;
}
