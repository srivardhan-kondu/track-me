"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Past this, something went wrong elsewhere; never leave a bar stuck on screen. */
const GIVE_UP_MS = 10_000;

/**
 * A thin violet bar along the top of the screen from the moment an in-app
 * link is tapped until the next page is on screen.
 *
 * Every page here renders on the server, so there is always a beat between
 * the tap and the new screen. Without a sign that the tap landed, that beat
 * reads as the app ignoring you, and people tap again.
 */
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = React.useState<"idle" | "loading" | "done">("idle");

  // The new URL is in: finish the bar, then fade it out.
  React.useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
  }, [pathname, search]);

  React.useEffect(() => {
    if (state === "done") {
      const t = setTimeout(() => setState("idle"), 250);
      return () => clearTimeout(t);
    }
    if (state === "loading") {
      const t = setTimeout(() => setState("idle"), GIVE_UP_MS);
      return () => clearTimeout(t);
    }
  }, [state]);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;

      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      // Same page (or only a #hash): nothing will load.
      if (url.pathname === location.pathname && url.search === location.search) return;
      // Route handlers (exports, media) are downloads, not pages.
      if (url.pathname.startsWith("/api/")) return;

      setState("loading");
    }

    // Capture phase: next/link cancels the native click before a bubbling
    // listener would ever see it.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (state === "idle") return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2.5px]"
    >
      <div
        className={
          state === "loading"
            ? "nav-progress-run h-full bg-accent shadow-[0_0_10px_var(--accent)]"
            : "nav-progress-done h-full bg-accent shadow-[0_0_10px_var(--accent)]"
        }
      />
    </div>
  );
}

export function NavProgress() {
  // useSearchParams needs a boundary, or every page above it turns dynamic.
  return (
    <React.Suspense fallback={null}>
      <Bar />
    </React.Suspense>
  );
}
