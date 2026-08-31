import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ComplianceStrip } from "@/components/charts/compliance-strip";
import { WeightChart } from "@/components/charts/weight-chart";
import { DaySwitcher } from "@/components/dashboard/day-switcher";
import { VolumeBreakdown } from "@/components/exercises/volume-breakdown";
import { SectionHeading } from "@/components/layout/page";
import { Timeline } from "@/components/timeline/timeline";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Metric, MetricStrip } from "@/components/ui/metric";
import { db } from "@/lib/db";
import { assertCanViewAthlete, requireCoach } from "@/lib/session";
import {
  addDaysInZone,
  formatDateInZone,
  fromDateParam,
  isSameDayInZone,
  safeZone,
  toDateParam,
} from "@/lib/tz";
import { initials } from "@/lib/utils";
import { getMuscleVolume } from "@/services/exercises/volume";
import {
  getCompliance,
  getDayTimeline,
  getDayTotals,
  getSummary,
  getWeightSeries,
} from "@/services/reporting";

export default async function AthleteReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const coach = await requireCoach();
  const { athleteId } = await params;
  const { date: dateParam } = await searchParams;

  try {
    await assertCanViewAthlete(coach.id, athleteId);
  } catch {
    notFound();
  }

  const athlete = await db.user.findUnique({
    where: { id: athleteId },
    select: { id: true, name: true, email: true, image: true, timeZone: true },
  });
  if (!athlete) notFound();

  // The coach reviews the athlete's days as the athlete lived them.
  const zone = safeZone(athlete.timeZone);
  const date = fromDateParam(dateParam, zone);
  const isToday = isSameDayInZone(date, new Date(), zone);

  const [entries, totals, summary, series, compliance, volume] =
    await Promise.all([
      getDayTimeline(athleteId, date, zone),
      getDayTotals(athleteId, date, zone),
      getSummary(athleteId, 7, zone),
      getWeightSeries(athleteId, 90, zone),
      getCompliance(athleteId, 14, zone),
      getMuscleVolume(athleteId, 7, zone),
    ]);

  const prev = addDaysInZone(date, -1, zone);
  const next = addDaysInZone(date, 1, zone);

  return (
    <>
      <Link
        href="/trainer"
        className="mono-label flex items-center gap-2 transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All athletes
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        <Avatar className="h-14 w-14">
          {athlete.image && <AvatarImage src={athlete.image} alt="" />}
          <AvatarFallback className="text-[13px]">
            {initials(athlete.name, athlete.email)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-[28px] leading-none text-fg sm:text-[30px]">
            {athlete.name ?? athlete.email}
          </h1>
          <p className="mt-2 truncate font-mono text-[11.5px] text-fg-dim">
            {athlete.email}
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <SectionHeading meta="Last 7 days">Weekly summary</SectionHeading>

        <MetricStrip>
          <Metric
            label="Avg calories"
            value={summary.avgCalories.toLocaleString()}
            unit="kcal"
          />
          <Metric label="Avg protein" value={summary.avgProtein} unit="g" />
          <Metric
            label="Weight change"
            value={
              summary.weightChangeKg !== null
                ? `${summary.weightChangeKg > 0 ? "+" : ""}${summary.weightChangeKg}`
                : "—"
            }
            unit={summary.weightChangeKg !== null ? "kg" : undefined}
            tone={
              summary.weightChangeKg !== null && summary.weightChangeKg <= 0
                ? "sage"
                : "default"
            }
          />
        </MetricStrip>

        <MetricStrip>
          <Metric label="Workouts" value={summary.totalWorkouts} note="sessions" />
          <Metric
            label="Meal compliance"
            value={`${summary.mealComplianceDays}/${summary.daysElapsed}`}
            note="days logged"
          />
          <Metric
            label="Weigh-ins"
            value={`${summary.weighInDays}/${summary.daysElapsed}`}
            note="days"
          />
        </MetricStrip>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <section className="rounded-2xl border border-line-strong bg-surface px-6 py-5">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[12.5px] font-semibold text-fg">Weight trend</p>
            <p className="mono-label">90 days</p>
          </div>
          <WeightChart points={series} className="mt-5" />
        </section>

        <section className="rounded-2xl border border-line p-[18px]">
          <p className="text-[12.5px] font-semibold text-fg">
            Logging consistency
          </p>
          <div className="mt-3.5">
            <ComplianceStrip
              days={compliance}
              caption={`${summary.totalMeals} meals and ${summary.totalWorkouts} workouts logged in the last 7 days.`}
            />
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeading meta="Last 7 days">
          Volume by muscle group
        </SectionHeading>
        <div className="rounded-2xl border border-line-strong bg-surface p-5">
          <p className="mb-4 text-[12px] leading-relaxed text-fg-dim">
            Weighted by how directly each exercise trains the group.
          </p>
          <VolumeBreakdown report={volume} days={7} />
        </div>
      </section>

      <section className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[13px] font-semibold text-fg">
              {formatDateInZone(date, zone)}
            </h2>
            <p className="tabular mt-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-fg-dim">
              {totals.calories.toLocaleString()} kcal · {totals.protein} p ·{" "}
              {totals.mealCount} meals · {totals.workoutCount} workouts
            </p>
          </div>

          <DaySwitcher
            prevHref={`/trainer/${athleteId}?date=${toDateParam(prev, zone)}`}
            todayHref={`/trainer/${athleteId}`}
            nextHref={`/trainer/${athleteId}?date=${toDateParam(next, zone)}`}
            isToday={isToday}
          />
        </div>

        <Timeline
          entries={entries}
          viewerId={coach.id}
          timeZone={zone}
          isOwner={false}
          canComment
          emptyState={
            <p className="text-[13px] text-fg-dim">
              Nothing logged on this day.
            </p>
          }
        />
      </section>
    </>
  );
}
