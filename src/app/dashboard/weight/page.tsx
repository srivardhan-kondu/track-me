import { ComplianceStrip } from "@/components/charts/compliance-strip";
import { WeightChart } from "@/components/charts/weight-chart";
import { EmptyState, SectionHeading } from "@/components/layout/page";
import { WeightForm } from "@/components/log/weight-form";
import { WeightActions } from "@/components/timeline/record-actions";
import { SegmentedLinks } from "@/components/ui/filter-pills";
import { BigStat } from "@/components/ui/metric";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { safeZone } from "@/lib/tz";
import { cn, round } from "@/lib/utils";
import { getCompliance, getWeightSeries } from "@/services/reporting";
import { mediaUrl } from "@/services/storage";

export const metadata = { title: "Weight" };

const RANGES = [
  { label: "30d", value: "30", days: 30, window: "30-day" },
  { label: "90d", value: "90", days: 90, window: "90-day" },
  { label: "1y", value: "365", days: 365, window: "one-year" },
] as const;

export default async function WeightPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireUser();
  const { range: rangeParam } = await searchParams;

  const range = RANGES.find((r) => r.value === rangeParam) ?? RANGES[1];
  const zone = safeZone(user.timeZone);

  const [series, compliance, entries] = await Promise.all([
    getWeightSeries(user.id, range.days, zone),
    getCompliance(user.id, 14, zone),
    db.weightEntry.findMany({
      where: { userId: user.id },
      orderBy: { day: "desc" },
      take: 30,
    }),
  ]);

  const withPhotos = await Promise.all(
    entries.map(async (e) => ({ ...e, photoUrl: await mediaUrl(e.photoKey) })),
  );

  const latest = series[series.length - 1]?.weightKg ?? null;
  const first = series[0]?.weightKg ?? null;
  const change =
    latest !== null && first !== null && series.length > 1
      ? round(latest - first, 1)
      : null;

  // Compare the last 7 days against the 7 before to smooth daily noise.
  const avg = (xs: typeof series) =>
    xs.length ? xs.reduce((a, p) => a + p.weightKg, 0) / xs.length : null;
  const recentAvg = avg(series.slice(-7));
  const priorAvg = avg(series.slice(-14, -7));
  const weeklyTrend =
    recentAvg !== null && priorAvg !== null
      ? round(recentAvg - priorAvg, 2)
      : null;

  const projection =
    weeklyTrend !== null && latest !== null && Math.abs(weeklyTrend) >= 0.05
      ? `Hold this and you're around ${round(latest + weeklyTrend * 4, 1)} kg in a month.`
      : weeklyTrend !== null
        ? "Holding steady — no drift either way this fortnight."
        : "A couple more check-ins and a weekly rate appears here.";

  const loggedDays = compliance.filter(
    (d) => d.meals > 0 || d.workouts > 0 || d.weighedIn,
  ).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-serif text-[28px] leading-none text-fg sm:text-[30px]">
            Weight
          </h1>
          <p className="mt-2.5 text-[13px] text-fg-dim">
            Morning check-ins · {range.window} window
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <SegmentedLinks
            active={range.value}
            options={RANGES.map((r) => ({
              label: r.label,
              value: r.value,
              href: `/dashboard/weight?range=${r.value}`,
            }))}
          />
          <WeightForm defaultWeight={latest} />
        </div>
      </div>

      <section className="rounded-2xl border border-line-strong bg-surface px-7 py-6">
        <div className="flex flex-wrap items-start gap-x-11 gap-y-6">
          <BigStat label="Current" value={latest ?? "—"} unit={latest !== null ? "kg" : undefined} />
          <BigStat
            label={`${range.window} change`}
            value={
              change !== null ? `${change > 0 ? "+" : ""}${change}` : "—"
            }
            unit={change !== null ? "kg" : undefined}
            tone={change !== null && change <= 0 ? "sage" : "default"}
          />
          <BigStat
            label="Weekly rate"
            value={
              weeklyTrend !== null
                ? `${weeklyTrend > 0 ? "+" : ""}${weeklyTrend}`
                : "—"
            }
            unit={weeklyTrend !== null ? "kg / wk" : undefined}
          />

          <div className="ml-auto max-w-[240px]">
            <p className="mono-label">Where this is heading</p>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-fg-muted">
              {projection}
            </p>
          </div>
        </div>

        <WeightChart points={series} className="mt-7" />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
        <section className="flex min-w-0 flex-col gap-3.5">
          <SectionHeading meta={`${series.length} in window`}>
            Check-in history
          </SectionHeading>

          {withPhotos.length === 0 ? (
            <EmptyState
              title="No check-ins yet"
              body="Weigh yourself after waking and before eating. One number today becomes the baseline everything else is measured against."
              action={<WeightForm />}
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {withPhotos.map((entry, i) => {
                const previous = withPhotos[i + 1];
                const delta = previous
                  ? round(entry.weightKg - previous.weightKg, 1)
                  : null;

                return (
                  <li
                    key={entry.id}
                    className={cn(
                      "flex items-center gap-4 rounded-xl border px-4 py-3",
                      i === 0
                        ? "border-line-strong bg-surface"
                        : "border-line bg-surface-muted",
                    )}
                  >
                    {entry.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.photoUrl}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-lg object-cover"
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-[13px] font-medium",
                          i === 0 ? "text-fg" : "text-fg-muted",
                        )}
                      >
                        {new Date(entry.day).toLocaleDateString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          timeZone: "UTC",
                        })}
                      </p>
                      {entry.notes && (
                        <p className="truncate text-[11.5px] text-fg-dim">
                          {entry.notes}
                        </p>
                      )}
                    </div>

                    <span
                      className={cn(
                        "tabular w-[52px] shrink-0 font-mono text-[11.5px]",
                        delta === null
                          ? "text-fg-faint"
                          : delta <= 0
                            ? "text-sage-text"
                            : "text-fg-dim",
                      )}
                    >
                      {delta === null
                        ? "—"
                        : `${delta > 0 ? "+" : ""}${delta}`}
                    </span>

                    <span className="tabular shrink-0 font-mono text-[13px] text-fg">
                      {entry.weightKg} kg
                    </span>

                    <WeightActions entryId={entry.id} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="rounded-2xl border border-line p-[18px]">
          <p className="text-[12.5px] font-semibold text-fg">Check-in rhythm</p>

          <div className="mt-3.5">
            <ComplianceStrip
              days={compliance}
              caption={`${loggedDays} of the last ${compliance.length} days logged. Missing one changes nothing — the trend line is what matters.`}
            />
          </div>
        </aside>
      </div>
    </>
  );
}
