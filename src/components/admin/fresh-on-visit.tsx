"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * The client router keeps visited pages for 30s (see next.config.ts) so the
 * app feels instant. The console must never act on a stale picture, so each
 * visit here shows the cached screen at once and then re-fetches it straight
 * away — fast to arrive, and current a moment later.
 */
export function FreshOnVisit() {
  const pathname = usePathname();
  const router = useRouter();
  const first = React.useRef(true);

  React.useEffect(() => {
    // The first render was just produced by the server; it is already fresh.
    if (first.current) {
      first.current = false;
      return;
    }
    router.refresh();
  }, [pathname, router]);

  return null;
}
