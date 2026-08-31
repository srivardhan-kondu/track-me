import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { Page } from "@/lib/admin";
import { cn } from "@/lib/utils";

/**
 * The console's table.
 *
 * Real tables rather than a grid of divs: these are rows of records that a
 * screen reader should read as rows, and that somebody will occasionally
 * select and paste into a spreadsheet. Every one scrolls inside its own
 * container, so a wide table never makes the page scroll sideways.
 */
export function Table({
  head,
  children,
  className,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-2xl border border-line-strong bg-surface",
        className,
      )}
    >
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  className,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "mono-label whitespace-nowrap px-4 py-3 font-semibold",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Tr({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "border-b border-line align-middle transition-colors last:border-0 hover:bg-hover",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  align = "left",
  className,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-[12.5px] text-fg-muted",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** A row that says nothing matched, without breaking the table's frame. */
export function EmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-12 text-center text-[12.5px] text-fg-dim"
      >
        {children}
      </td>
    </tr>
  );
}

/** An identifier, set so it cannot be mistaken for prose. */
export function Mono({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn("tabular text-[11.5px] text-fg-dim", className)}
    >
      {children}
    </span>
  );
}

/**
 * Prev/next for a paged list.
 *
 * Links rather than buttons, so a page is a URL somebody can bookmark or send
 * to a colleague — which is most of the point of a support console.
 */
export function Pager({
  page,
  href,
  noun = "rows",
}: {
  page: Page;
  /** Builds the URL for a page number, keeping the current filters. */
  href: (page: number) => string;
  noun?: string;
}) {
  if (page.total === 0) return null;

  const step = (to: number, label: string, icon: React.ReactNode, on: boolean) =>
    on ? (
      <Link
        href={href(to)}
        aria-label={label}
        className="grid h-8 w-8 place-items-center rounded-full border border-line-strong text-fg-muted transition-colors hover:border-accent-line hover:text-fg"
      >
        {icon}
      </Link>
    ) : (
      <span className="grid h-8 w-8 place-items-center rounded-full border border-line text-fg-faint">
        {icon}
      </span>
    );

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="tabular font-mono text-[11px] text-fg-dim">
        {page.from}–{page.to} of {page.total.toLocaleString()} {noun}
      </p>

      <div className="flex items-center gap-2">
        <span className="tabular font-mono text-[11px] text-fg-dim">
          Page {page.page} of {page.pages}
        </span>
        {step(
          page.page - 1,
          "Previous page",
          <ChevronLeft className="h-4 w-4" />,
          page.hasPrev,
        )}
        {step(
          page.page + 1,
          "Next page",
          <ChevronRight className="h-4 w-4" />,
          page.hasNext,
        )}
      </div>
    </div>
  );
}
