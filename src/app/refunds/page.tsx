import Link from "next/link";

import { Clause, LegalPage, Points } from "@/components/layout/legal";
import { BUSINESS } from "@/lib/business";
import { PRICES, TRIAL_DAYS } from "@/lib/entitlements";

export const metadata = {
  title: "Refunds & Cancellation",
  description:
    "When a Track Me subscription can be refunded, how to cancel, and how long a refund takes.",
};

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refunds & Cancellation"
      summary="What happens if you change your mind, are charged in error, or want to stop paying."
    >
      <Clause title="1. Try it before you pay">
        <p>
          Every new account gets {TRIAL_DAYS} days of Premium at no cost and
          without entering card details. The trial exists so you can decide
          whether {BUSINESS.product} is worth paying for before any money
          changes hands, and we would rather you used it than asked for a refund
          later.
        </p>
      </Clause>

      <Clause title="2. Cancelling">
        <p>
          Subscriptions do not renew automatically. A monthly or yearly plan
          simply runs to the end of the period you paid for, after which your
          account returns to the free plan. There is nothing to cancel and no
          notice to give.
        </p>
        <p>
          You keep Premium for the whole period you have paid for. Ending a plan
          early does not entitle you to a partial refund of the unused days.
        </p>
      </Clause>

      <Clause title="3. When we will refund you">
        <p>We refund in full, without argument, in these cases:</p>
        <Points
          items={[
            "You were charged more than once for the same plan.",
            "You were charged after your plan had already ended, or without choosing to pay.",
            "A fault on our side stopped you using the Premium features you paid for, and we could not fix it within a reasonable time.",
            <>
              You bought a plan and changed your mind within{" "}
              <strong className="text-fg">7 days</strong>, and have not used the
              Premium features in that time.
            </>,
          ]}
        />
      </Clause>

      <Clause title="4. When we will not">
        <Points
          items={[
            "More than 7 days have passed since the charge.",
            "You used the Premium features during those 7 days — progress photos, AI analysis, or history beyond the free window.",
            "You are dissatisfied with the accuracy of an AI estimate. These are approximations, and we say so before you pay.",
            "Your account was suspended for breaching our Terms.",
          ]}
        />
        <p>
          The Founder&apos;s plan ({`₹${PRICES.LIFETIME / 100}`}, paid once)
          carries the same 7-day window as any other plan. After that it is
          final, which is part of why it costs what it does.
        </p>
      </Clause>

      <Clause title="5. How to ask for one">
        <p>
          Write to{" "}
          <Link
            href={`mailto:${BUSINESS.email}`}
            className="text-accent-text underline-offset-4 hover:underline"
          >
            {BUSINESS.email}
          </Link>{" "}
          from the email address on the account, and include the payment ID from
          your Razorpay receipt. We reply within {BUSINESS.responseTime}.
        </p>
      </Clause>

      <Clause title="6. How long it takes">
        <p>
          Approved refunds are issued to the original payment method within{" "}
          <strong className="text-fg">5 to 7 working days</strong>. How long it
          then takes to appear on your statement is up to your bank or card
          issuer, and is typically a further 3 to 5 working days for cards and
          faster for UPI.
        </p>
        <p>
          We do not refund to a different account, card or UPI ID from the one
          that paid.
        </p>
      </Clause>

      <Clause title="7. If a payment fails">
        <p>
          If money left your account but Premium was not activated, nothing is
          lost — the payment is recorded against your account and applied
          automatically. If it has not resolved within an hour, email us with
          the payment ID and we will either activate the plan or refund it in
          full.
        </p>
      </Clause>
    </LegalPage>
  );
}
