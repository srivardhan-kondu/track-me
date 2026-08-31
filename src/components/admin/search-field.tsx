"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";

/**
 * Search that writes to the URL.
 *
 * Deliberately not a live-filtering input over a client-side array: the lists
 * in this console are paged in the database, so the query has to be part of
 * the address anyway — which has the happy side effect that any view an admin
 * finds is a link they can paste into a support thread.
 *
 * Submitted rather than debounced. A keystroke here is a database query
 * against every user in the system, and an admin typing an email address
 * would otherwise fire a dozen of them on the way to one answer.
 */
export function SearchField({
  placeholder = "Search",
  paramName = "q",
  className,
}: {
  placeholder?: string;
  paramName?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const current = params.get(paramName) ?? "";
  const [value, setValue] = React.useState(current);

  // Keeps the box in step with the address when the URL changes underneath it
  // — the back button, or a filter pill that clears the search.
  React.useEffect(() => setValue(current), [current]);

  function submit(next: string) {
    const query = new URLSearchParams(params.toString());
    if (next.trim()) query.set(paramName, next.trim());
    else query.delete(paramName);
    // Any new query starts at the first page; page 4 of the old result set
    // says nothing about the new one.
    query.delete("page");
    router.push(`${pathname}?${query.toString()}`);
  }

  return (
    <form
      role="search"
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        submit(value);
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
        <Input
          type="search"
          name={paramName}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="pl-10 pr-10"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setValue("");
              submit("");
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-faint transition-colors hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </form>
  );
}
