"use client";

import * as React from "react";
import Link from "next/link";

/**
 * What a route shows when it throws.
 *
 * The default is a bare "Application error: a client-side exception has
 * occurred", which tells the person nothing and tells us less — the one thing
 * worth having, the error and its digest, is the thing it hides. Both are
 * shown here so a screenshot is enough to act on.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-serif text-[26px] leading-tight text-fg">
        That screen failed to load
      </h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-fg-muted">
        Nothing you logged is affected. Try again, and if it keeps happening
        send us the detail below.
      </p>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={reset}
          className="flex h-[42px] items-center rounded-[14px] bg-accent px-5 text-[13.5px] font-semibold text-accent-ink"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="flex h-[42px] items-center rounded-[14px] border border-line px-5 text-[13.5px] font-semibold text-fg"
        >
          Back to today
        </Link>
      </div>

      <pre className="mt-8 overflow-x-auto rounded-[14px] border border-line bg-surface p-4 text-[11.5px] leading-relaxed text-fg-dim">
        {error.message || "Unknown error"}
        {error.digest ? `\n\ndigest: ${error.digest}` : ""}
      </pre>
    </div>
  );
}
