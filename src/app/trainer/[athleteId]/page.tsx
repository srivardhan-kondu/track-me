import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

import { ComplianceStrip } from "@/components/charts/compliance-strip";
import { WeightChart } from "@/components/charts/weight-chart";
import { StatTile } from "@/components/timeline/macros";
import { Timeline } from "@/components/timeline/timeline";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const [entries, totals, summary, series, compliance] = await Promise.all([
    getDayTimeline(athleteId, date, zone),
    getDayTotals(athleteId, date, zone),
    getSummary(athleteId, 7, zone),
    getWeightSeries(athleteId, 90, zone),
    getCompliance(athleteId, 14, zone),
  ]);

  const prev = addDaysInZone(date, -1, zone);
  const next = addDaysInZone(date, 1, zone);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-2">
        <Link href="/trainer">
          <ArrowLeft className="h-4 w-4" />
          All athletes
        </Link>
      </Button>

      <header className="flex flex-wrap items-center gap-4">
        <Avatar className="h-14 w-14">
          {athlete.image && <AvatarImage src={athlete.image} alt="" />}
          <AvatarFallback className="text-base">
            {initials(athlete.name, athlete.email)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {athlete.name ?? athlete.email}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {athlete.email}
          </p>
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          Weekly summary
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile
            label="Avg calories"
            value={summary.avgCalories}
            unit="kcal"
          />
          <StatTile
            label="Avg protein"
            value={summary.avgProtein}
            unit="g"
            accent="var(--chart-protein)"
          />
          <StatTile
            label="Weight change"
            value={
              summary.weightChangeKg !== null
                ? summary.weightChangeKg > 0
                  ? `+${summary.weightChangeKg}`
                  : summary.weightChangeKg
                : "—"
            }
            unit={summary.weightChangeKg !== null ? "kg" : undefined}
          />
          <StatTile
            label="Workouts"
            value={summary.totalWorkouts}
            hint="last 7 days"
          />
          <StatTile
            label="Meal compliance"
            value={`${summary.mealComplianceDays}/${summary.daysElapsed}`}
            hint="days logged"
          />
          <StatTile
            label="Weigh-ins"
            value={`${summary.weighInDays}/${summary.daysElapsed}`}
            hint="days"
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weight trend</CardTitle>
          </CardHeader>
          <CardContent>
            <WeightChart points={series} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logging consistency</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col justify-center">
            <ComplianceStrip days={compliance} />
            <p className="mt-4 text-sm text-muted-foreground">
              {summary.totalMeals} meals and {summary.totalWorkouts} workouts
              logged in the last 7 days.
            </p>
          </CardContent>
        </Card>
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">
              {formatDateInZone(date, zone)}
            </h2>
            <p className="tabular mt-0.5 text-xs text-muted-foreground">
              {totals.calories} kcal · {totals.protein}g protein ·{" "}
              {totals.mealCount} meals · {totals.workoutCount} workouts
            </p>
          </div>

          <div className="flex items-center gap-1">
            <Button
              asChild
              variant="outline"
              size="icon"
              aria-label="Previous day"
            >
              <Link href={`/trainer/${athleteId}?date=${toDateParam(prev, zone)}`}>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            {!isToday && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/trainer/${athleteId}`}>Today</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="icon" aria-label="Next day">
              <Link href={`/trainer/${athleteId}?date=${toDateParam(next, zone)}`}>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <Timeline
          entries={entries}
          viewerId={coach.id}
          timeZone={zone}
          isOwner={false}
          canComment
          emptyState={
            <p className="text-sm text-muted-foreground">
              Nothing logged on this day.
            </p>
          }
        />
      </section>
    </div>
  );
}
