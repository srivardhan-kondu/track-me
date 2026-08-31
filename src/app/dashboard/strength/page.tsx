import { PremiumNotice } from "@/components/billing/premium-notice";
import { StrengthLine } from "@/components/charts/strength-line";
import { EmptyState, SectionHeading } from "@/components/layout/page";
import { premiumStatus, requireUser } from "@/lib/session";
import {
  getPersonalRecords,
  getProgression,
  RELIABLE_REPS,
} from "@/services/strength";

export const metadata = { title: "Strength" };

/** A year of training shows a trend without drowning the chart. */
const WINDOW_DAYS = 365;

function shortDate(d: Date) {
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default async function StrengthPage() {
  const user = await requireUser();
  const { premium } = await premiumStatus(user.id);

  if (!premium) {
    return (
      <>
        <div className="min-w-0 max-w-xl">
          <h1 className="font-serif text-[28px] leading-none text-fg sm:text-[30px]">
            Strength
          </h1>
          <p className="mt-2.5 text-[13px] leading-relaxed text-fg-dim">
            Personal records and estimated one-rep max, tracked across every
            session you log.
          </p>
        </div>

        <PremiumNotice
          title="Strength tracking is part of Premium"
          body="Your sessions are already being recorded — nothing is lost while you are on the free plan. Premium turns them into personal records and progression charts."
        />
      </>
    );
  }

  const [records, progression] = await Promise.all([
    getPersonalRecords(user.id),
    getProgression(user.id, WINDOW_DAYS),
  ]);

  return (
    <>
      <div className="min-w-0 max-w-xl">
        <h1 className="font-serif text-[28px] leading-none text-fg sm:text-[30px]">
          Strength
        </h1>
        <p className="mt-2.5 text-[13px] leading-relaxed text-fg-dim">
          Your best set of every movement, and where the trend is heading.
          One-rep maxes are estimated from the sets you logged, not tested.
        </p>
      </div>

      {records.length === 0 ? (
        <EmptyState
          title="No lifts recorded yet"
          body="Log a session with a weight and a rep count and your first records will appear here. Bodyweight movements are not tracked, since there is no load to compare."
        />
      ) : (
        <>
          {progression.length > 0 && (
            <section className="flex flex-col gap-3.5">
              <SectionHeading meta="Estimated 1RM">Progression</SectionHeading>

              <div className="grid gap-3.5 sm:grid-cols-2">
                {progression.map((p) => {
                  const latest = p.points[p.points.length - 1];
                  const rising = p.changeKg > 0;
                  return (
                    <div
                      key={p.exercise}
                      className="rounded-2xl border border-line-strong bg-surface p-5"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="text-[13px] font-semibold text-fg">
                          {p.exercise}
                        </h3>
                        <span
                          className={
                            rising
                              ? "tabular font-mono text-[11.5px] text-sage-text"
                              : "tabular font-mono text-[11.5px] text-fg-dim"
                          }
                        >
                          {rising ? "+" : ""}
                          {p.changeKg} kg
                        </span>
                      </div>

                      <p className="tabular mt-1 font-serif text-[26px] leading-none text-fg">
                        {latest.e1rm}
                        <span className="ml-1 font-sans text-[12px] text-fg-dim">
                          kg
                        </span>
                      </p>

                      <div className="mt-4 text-accent">
                        <StrengthLine points={p.points} />
                      </div>

                      <p className="mono-label mt-2.5">
                        {p.points.length} sessions · since{" "}
                        {shortDate(p.points[0].at)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3.5">
            <SectionHeading meta={`${records.length} movements`}>
              Personal records
            </SectionHeading>

            <div className="overflow-x-auto rounded-2xl border border-line-strong bg-surface">
              <table className="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr className="border-b border-line">
                    <th className="mono-label px-5 py-3 text-left font-normal">
                      Movement
                    </th>
                    <th className="mono-label px-5 py-3 text-right font-normal">
                      Heaviest
                    </th>
                    <th className="mono-label px-5 py-3 text-right font-normal">
                      Best set
                    </th>
                    <th className="mono-label px-5 py-3 text-right font-normal">
                      Est. 1RM
                    </th>
                    <th className="mono-label px-5 py-3 text-right font-normal">
                      Achieved
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr
                      key={r.exercise}
                      className="border-b border-line last:border-0"
                    >
                      <td className="px-5 py-3.5 text-[12.5px] font-medium text-fg">
                        {r.exercise}
                        <span className="ml-2 font-mono text-[10px] text-fg-faint">
                          {r.sessions}×
                        </span>
                      </td>
                      <td className="tabular px-5 py-3.5 text-right font-mono text-[12px] text-fg-muted">
                        {r.heaviestKg} kg × {r.heaviestReps}
                      </td>
                      <td className="tabular px-5 py-3.5 text-right font-mono text-[12px] text-fg-muted">
                        {r.bestSetKg} kg × {r.bestSetReps}
                      </td>
                      <td className="tabular px-5 py-3.5 text-right font-mono text-[12px] font-semibold text-fg">
                        {r.bestE1RM} kg
                        {r.estimateIsSoft && (
                          <span
                            className="ml-1 text-fg-faint"
                            title={`Estimated from more than ${RELIABLE_REPS} reps, so treat it loosely`}
                          >
                            *
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right text-[11.5px] text-fg-dim">
                        {shortDate(r.achievedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11.5px] leading-relaxed text-fg-dim">
              Estimated one-rep max uses Epley&apos;s formula. Sets marked{" "}
              <span className="font-mono">*</span> ran past {RELIABLE_REPS}{" "}
              reps, where the estimate says more about endurance than strength.
              None of this is a substitute for actually testing a max under
              supervision.
            </p>
          </section>
        </>
      )}
    </>
  );
}
