import Link from "next/link";

import { Clause, LegalPage } from "@/components/layout/legal";
import { BUSINESS } from "@/lib/business";

export const metadata = {
  title: "Contact",
  description: `How to reach ${BUSINESS.legalName}, who operates ${BUSINESS.product}.`,
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line py-3.5 last:border-0 sm:flex-row sm:gap-6">
      <span className="mono-label sm:w-[140px] sm:shrink-0 sm:pt-[3px]">
        {label}
      </span>
      <span className="text-[13px] leading-relaxed text-fg">{children}</span>
    </div>
  );
}

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact"
      summary={`${BUSINESS.product} is built and operated by one person. Mail reaches them directly.`}
    >
      <Clause title="Get in touch">
        <div className="flex flex-col">
          <Row label="Email">
            <Link
              href={`mailto:${BUSINESS.email}`}
              className="text-accent-text underline-offset-4 hover:underline"
            >
              {BUSINESS.email}
            </Link>
          </Row>
          <Row label="Phone">
            <Link
              href={`tel:${BUSINESS.phone.replace(/\s/g, "")}`}
              className="text-accent-text underline-offset-4 hover:underline"
            >
              {BUSINESS.phone}
            </Link>
          </Row>
          <Row label="Hours">{BUSINESS.supportHours}</Row>
          <Row label="Response time">Within {BUSINESS.responseTime}</Row>
        </div>
      </Clause>

      <Clause title="Registered address">
        <address className="not-italic leading-[1.9]">
          {BUSINESS.legalName}
          <br />
          {BUSINESS.address.map((line) => (
            <span key={line}>
              {line}
              <br />
            </span>
          ))}
        </address>
        <p className="text-[12px] text-fg-dim">
          {BUSINESS.entityType}. Correspondence about billing, refunds and data
          requests should go to the email address above rather than by post —
          it is very much faster.
        </p>
      </Clause>

      <Clause title="What to include">
        <p>
          For anything about a payment, quote the payment ID from your Razorpay
          receipt — it begins with <code className="font-mono">pay_</code>. For
          anything about your data, write from the email address on the account
          so we can be sure it is you.
        </p>
      </Clause>
    </LegalPage>
  );
}
