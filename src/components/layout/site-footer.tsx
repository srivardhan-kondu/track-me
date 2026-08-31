import Link from "next/link";

import { BUSINESS } from "@/lib/business";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/refunds", label: "Refunds & Cancellation" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/contact", label: "Contact" },
];

/**
 * Present on every public page. Beyond being useful, a payment gateway's
 * activation review looks for exactly these links before approving a merchant
 * — policies that exist but cannot be reached from the homepage read as
 * policies that do not exist.
 */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t border-line pt-7", className)}>
      <nav className="flex flex-wrap gap-x-5 gap-y-2.5">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-[12px] text-fg-dim transition-colors hover:text-fg"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <p className="mt-5 text-[11.5px] leading-relaxed text-fg-faint">
        {BUSINESS.product} is operated by {BUSINESS.legalName}.{" "}
        <Link
          href={`mailto:${BUSINESS.email}`}
          className="hover:text-fg-dim"
        >
          {BUSINESS.email}
        </Link>{" "}
        · {BUSINESS.phone}
      </p>
    </footer>
  );
}
