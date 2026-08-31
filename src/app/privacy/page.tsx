import Link from "next/link";

import { Clause, LegalPage, Points } from "@/components/layout/legal";
import { BUSINESS } from "@/lib/business";
import { FREE_HISTORY_DAYS } from "@/lib/entitlements";

export const metadata = {
  title: "Privacy Policy",
  description: `What ${BUSINESS.product} collects, why, who it is shared with, and how to have it deleted.`,
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary="Track Me holds photographs of your body and a record of what you eat. That deserves a policy written plainly rather than defensively."
    >
      <Clause title="1. Who is responsible">
        <p>
          {BUSINESS.legalName} ({BUSINESS.entityType}) decides how your data is
          handled and is the point of contact for any question about it:{" "}
          <Link
            href={`mailto:${BUSINESS.email}`}
            className="text-accent-text underline-offset-4 hover:underline"
          >
            {BUSINESS.email}
          </Link>
          .
        </p>
      </Clause>

      <Clause title="2. What we collect">
        <p>
          <strong className="text-fg">From your Google account, at sign-in:</strong>{" "}
          your name, email address and profile picture. We never receive your
          Google password.
        </p>
        <p>
          <strong className="text-fg">What you record:</strong>
        </p>
        <Points
          items={[
            "Meals — descriptions, photographs, voice notes, and the calorie and macronutrient figures derived from them.",
            "Workouts — exercises, sets, repetitions, weights, duration and voice notes.",
            "Body weight, and any photograph attached to a check-in.",
            "Progress photographs, front, side and back.",
            "Your height, and the timezone your browser reports.",
          ]}
        />
        <p>
          <strong className="text-fg">When you pay:</strong> a record of the
          payment — amount, plan, Razorpay payment identifier, and the email and
          phone number given at checkout. Card numbers, UPI PINs and bank
          credentials never reach us; they go directly to Razorpay.
        </p>
      </Clause>

      <Clause title="3. This is health data">
        <p>
          Body weight, meal records and photographs of your physique are
          sensitive personal information. We treat them accordingly: they are
          not sold, not shared with advertisers, not used to build any profile
          of you beyond what the app shows you, and not used to train any model
          of ours.
        </p>
      </Clause>

      <Clause title="4. Why we hold it">
        <Points
          items={[
            "To run the service you asked for — storing what you log and showing it back to you.",
            "To produce the reports and estimates that are the point of the product.",
            "To show your data to a coach you have explicitly connected to your account, and to nobody else.",
            "To take payment and keep the financial records the law requires.",
            "To investigate faults and abuse.",
          ]}
        />
      </Clause>

      <Clause title="5. Who it goes to">
        <p>
          We use a small number of processors, each of which sees only what it
          needs to do its job:
        </p>
        <Points
          items={[
            <>
              <strong className="text-fg">Neon</strong> — the database holding
              your records, hosted in the United States.
            </>,
            <>
              <strong className="text-fg">Cloudflare R2 / object storage</strong>{" "}
              — photographs and voice notes.
            </>,
            <>
              <strong className="text-fg">OpenAI</strong> — receives the voice
              notes, meal photographs and progress photographs that you submit
              for analysis, in order to return a transcript or an estimate. It
              is sent through the API, which is not used to train their models.
            </>,
            <>
              <strong className="text-fg">Razorpay</strong> — payment
              processing. They receive your payment details directly; we receive
              only the result.
            </>,
            <>
              <strong className="text-fg">Vercel</strong> — hosting.
            </>,
            <>
              <strong className="text-fg">Google</strong> — sign-in only.
            </>,
          ]}
        />
        <p>
          Your data crosses borders as a consequence — chiefly to the United
          States. We share it with nobody else, and we do not sell it under any
          circumstances.
        </p>
      </Clause>

      <Clause title="6. Coaches">
        <p>
          A coach linked to your account can see your timeline — meals,
          sessions, weigh-ins and photographs — and leave comments on it. This
          only happens after a coach adds you by the email address on your
          account. Ask us to remove the link and it stops immediately.
        </p>
      </Clause>

      <Clause title="7. How long we keep it">
        <p>
          For as long as your account exists. On the free plan the app shows you
          only the last {FREE_HISTORY_DAYS} days, but nothing older is deleted —
          it becomes visible again if you subscribe.
        </p>
        <p>
          When you ask us to delete your account, your records and uploaded
          files are removed within 30 days. Payment records are kept for as long
          as tax and accounting law requires, which in India is presently eight
          years, and which we cannot shorten on request.
        </p>
      </Clause>

      <Clause title="8. Your rights">
        <p>
          Write to us at{" "}
          <Link
            href={`mailto:${BUSINESS.email}`}
            className="text-accent-text underline-offset-4 hover:underline"
          >
            {BUSINESS.email}
          </Link>{" "}
          from the address on your account and you may:
        </p>
        <Points
          items={[
            "Ask for a copy of everything we hold about you.",
            "Have anything inaccurate corrected.",
            "Have your account and its contents deleted.",
            "Withdraw a coach's access.",
            "Object to a particular use of your data.",
          ]}
        />
        <p>We answer within {BUSINESS.responseTime}.</p>
      </Clause>

      <Clause title="9. Security">
        <p>
          Data is encrypted in transit. Photographs and voice notes are served
          through short-lived links rather than public URLs, so possessing a
          link does not grant lasting access. Access to the production database
          is limited to the operator.
        </p>
        <p>
          No system is perfectly secure, and we will not pretend otherwise. If a
          breach affects your data we will tell you promptly and say what
          happened.
        </p>
      </Clause>

      <Clause title="10. Children">
        <p>
          {BUSINESS.product} is not for anyone under 18. We do not knowingly
          collect data from children, and will delete any account we discover
          belongs to one.
        </p>
      </Clause>

      <Clause title="11. Cookies">
        <p>
          We set a session cookie to keep you signed in, and store your theme
          preference in your browser. There is no advertising, no analytics
          tracking and no third-party cookie.
        </p>
      </Clause>

      <Clause title="12. Changes">
        <p>
          If this policy changes materially, we will say so in the app or by
          email before it takes effect. The revision date at the top of this
          page always reflects the current version.
        </p>
      </Clause>
    </LegalPage>
  );
}
