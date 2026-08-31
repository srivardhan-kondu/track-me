import Link from "next/link";

import { Clause, LegalPage, Points } from "@/components/layout/legal";
import { BUSINESS } from "@/lib/business";
import { TRIAL_DAYS } from "@/lib/entitlements";

export const metadata = {
  title: "Terms & Conditions",
  description: `The agreement between you and ${BUSINESS.legalName} for the use of ${BUSINESS.product}.`,
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      summary={`These terms govern your use of ${BUSINESS.product}. By creating an account you agree to them.`}
    >
      <Clause title="1. Who you are dealing with">
        <p>
          {BUSINESS.product} is operated by {BUSINESS.legalName} (
          {BUSINESS.entityType}), contactable at{" "}
          <Link
            href={`mailto:${BUSINESS.email}`}
            className="text-accent-text underline-offset-4 hover:underline"
          >
            {BUSINESS.email}
          </Link>
          . Throughout these terms, &ldquo;we&rdquo; means that operator and
          &ldquo;you&rdquo; means the person using the service.
        </p>
      </Clause>

      <Clause title="2. What the service is">
        <p>
          {BUSINESS.product} records training, meals and body weight, and
          presents them back as a timeline and a set of reports. Some features
          use automated analysis to turn a voice note or a photograph into
          structured data. A coach you connect to your account can read what you
          log and leave comments on it.
        </p>
      </Clause>

      <Clause title="3. Not medical advice">
        <p>
          This is the most important clause on this page.{" "}
          {BUSINESS.product} is a logging and reporting tool. It is not a
          medical device, it does not diagnose anything, and nothing it shows
          you is medical, nutritional or clinical advice.
        </p>
        <Points
          items={[
            "Calorie and macronutrient figures are estimates produced by an automated model from a photograph or a description. They are useful for observing trends over weeks. They are not accurate enough to manage a medical condition with.",
            "Physique analysis is a subjective visual assessment, not a body composition measurement.",
            "Do not use this service to make decisions about a medical condition, a medication, an eating disorder, or a pregnancy.",
            "Consult a qualified doctor or dietitian before starting any new training or nutrition programme.",
          ]}
        />
      </Clause>

      <Clause title="4. Your account">
        <p>
          You must be at least 18 years old to use {BUSINESS.product}. You are
          responsible for what happens under your account, including keeping
          access to the email address it is tied to. Tell us promptly if you
          believe someone else has got into it.
        </p>
        <p>
          One account is for one person. Sharing an account, or reselling access
          to one, is not permitted.
        </p>
      </Clause>

      <Clause title="5. Your data belongs to you">
        <p>
          Everything you record — meals, sessions, weights, photographs, notes —
          remains yours. We store and process it to provide the service, as
          described in our{" "}
          <Link
            href="/privacy"
            className="text-accent-text underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>
          . We do not sell it, and we do not use your progress photographs to
          train any model of our own.
        </p>
        <p>
          You grant us only the permission needed to run the service: to store
          your content, to send it to the processors listed in the Privacy
          Policy, and to show it to a coach you have chosen to connect.
        </p>
      </Clause>

      <Clause title="6. Plans and payment">
        <p>
          New accounts include {TRIAL_DAYS} days of Premium at no cost and
          without card details. After that, Premium features require a paid
          plan at the prices shown on our{" "}
          <Link
            href="/pricing"
            className="text-accent-text underline-offset-4 hover:underline"
          >
            Pricing page
          </Link>
          . Free accounts continue to work indefinitely, with a shorter history
          window.
        </p>
        <p>
          Payments are processed by Razorpay. We never see or store your card
          number, UPI PIN or bank credentials. Plans do not renew automatically:
          when a period ends, the account returns to the free plan until you
          choose to pay again.
        </p>
        <p>
          Refunds are governed by our{" "}
          <Link
            href="/refunds"
            className="text-accent-text underline-offset-4 hover:underline"
          >
            Refunds & Cancellation policy
          </Link>
          .
        </p>
      </Clause>

      <Clause title="7. Acceptable use">
        <p>You agree not to:</p>
        <Points
          items={[
            "Upload photographs of anyone other than yourself, or of anyone who has not agreed to it.",
            "Upload unlawful, abusive or sexually explicit material.",
            "Attempt to access another user's data, or to probe, scan or disrupt the service.",
            "Automate access at a volume that degrades the service for others.",
            "Resell or redistribute access to the service.",
          ]}
        />
      </Clause>

      <Clause title="8. Availability">
        <p>
          We aim to keep {BUSINESS.product} running continuously, but it is
          provided as it is, without a guaranteed level of availability.
          Maintenance, third-party outages and faults will occasionally
          interrupt it. Where a fault prevents you using something you paid for,
          the Refunds policy applies.
        </p>
      </Clause>

      <Clause title="9. Ending the agreement">
        <p>
          You may stop using the service and ask us to delete your account at
          any time by writing to us. We may suspend or close an account that
          breaches these terms, and will explain why unless we are prevented
          from doing so by law.
        </p>
      </Clause>

      <Clause title="10. Liability">
        <p>
          To the extent the law allows, we are not liable for indirect or
          consequential loss, for lost profits, or for any decision you take on
          the basis of an estimate the service produced. Where liability cannot
          be excluded, it is limited to the amount you paid us in the twelve
          months before the claim arose.
        </p>
        <p>Nothing here limits liability for fraud, or for anything else that cannot lawfully be limited.</p>
      </Clause>

      <Clause title="11. Changes">
        <p>
          We may revise these terms. Where a change materially affects you, we
          will say so in the app or by email before it takes effect. Continuing
          to use the service after that means you accept the revision.
        </p>
      </Clause>

      <Clause title="12. Governing law">
        <p>
          These terms are governed by the laws of India, and the courts at{" "}
          {BUSINESS.jurisdiction} have exclusive jurisdiction over any dispute
          arising from them.
        </p>
      </Clause>
    </LegalPage>
  );
}
