import Link from "next/link";

import { Logo } from "@/components/layout/shell";
import { SiteFooter } from "@/components/layout/site-footer";
import { BUSINESS, businessDetailsIncomplete } from "@/lib/business";

/**
 * The shell every policy page shares: a narrow measure, the wordmark, a
 * revision date, and the footer that makes the other policies reachable.
 * Reviewers look for that cross-linking as much as for the text itself.
 */
export function LegalPage({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[760px] px-6 py-12 sm:py-16">
      <div className="mb-10">
        <Logo href="/" />
      </div>

      <h1 className="font-serif text-[32px] leading-[1.1] text-fg sm:text-[38px]">
        {title}
      </h1>
      <p className="mt-3.5 text-[13.5px] leading-relaxed text-fg-dim">
        {summary}
      </p>
      <p className="mono-label mt-5">Last updated {BUSINESS.lastUpdated}</p>

      {businessDetailsIncomplete && process.env.NODE_ENV !== "production" && (
        <p className="mt-6 rounded-xl border border-dashed border-clay-line p-3.5 text-[12px] leading-relaxed text-clay-text">
          The business address or jurisdiction in{" "}
          <code className="font-mono">src/lib/business.ts</code> is still a
          placeholder. Razorpay checks for a complete address during activation.
          This notice is not shown in production.
        </p>
      )}

      <div className="mt-10 flex flex-col gap-9">{children}</div>

      <div className="mt-14 rounded-2xl border border-line-strong bg-surface-muted p-5">
        <p className="text-[12.5px] leading-relaxed text-fg-dim">
          Questions about this page? Write to{" "}
          <Link
            href={`mailto:${BUSINESS.email}`}
            className="text-accent-text underline-offset-4 hover:underline"
          >
            {BUSINESS.email}
          </Link>
          .
        </p>
      </div>

      <SiteFooter className="mt-12" />
    </main>
  );
}

/** One numbered clause. */
export function Clause({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-[14px] font-semibold text-fg">{title}</h2>
      <div className="mt-2.5 flex flex-col gap-3 text-[13px] leading-[1.75] text-fg-muted">
        {children}
      </div>
    </section>
  );
}

/** A bulleted list inside a clause. */
export function Points({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            aria-hidden
            className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-accent-line"
          />
          <span className="flex-1">{item}</span>
        </li>
      ))}
    </ul>
  );
}
