import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { MealForm } from "@/components/log/meal-form";
import { WeightForm } from "@/components/log/weight-form";
import { WorkoutForm } from "@/components/log/workout-form";
import { StatTile } from "@/components/timeline/macros";
import { ProcessingWatcher } from "@/components/timeline/processing-watcher";
import { Timeline } from "@/components/timeline/timeline";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  addDaysInZone,
  formatDateInZone,
  fromDateParam,
  isSameDayInZone,
  safeZone,
  toDateParam,
} from "@/lib/tz";
import { getDayTimeline, getDayTotals } from "@/services/reporting";

export const metadata = { title: "Today" };
// Meal and workout logging run transcription and analysis in after(), which
// counts toward this function's duration. 60s is the Vercel Hobby ceiling.
export const maxDuration = 60;

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const { date: dateParam } = await searchParams;

  const zone = safeZone(user.timeZone);
  const date = fromDateParam(dateParam, zone);
  const isToday = isSameDayInZone(date, new Date(), zone);

  const [entries, totals, pending, lastWeight] = await Promise.all([
    getDayTimeline(user.id, date, zone),
    getDayTotals(user.id, date, zone),
    db.meal.count({
      where: { userId: user.id, status: { in: ["PENDING", "PROCESSING"] } },
    }),
    db.weightEntry.findFirst({
      where: { userId: user.id },
      orderBy: { day: "desc" },
      select: { weightKg: true },
    }),
  ]);

  const prev = addDaysInZone(date, -1, zone);
  const next = addDaysInZone(date, 1, zone);

  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <ProcessingWatcher initialPending={pending} />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isToday ? `Hey ${firstName}` : "Timeline"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateInZone(date, zone)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon" aria-label="Previous day">
            <Link href={`/dashboard?date=${toDateParam(prev, zone)}`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          {!isToday && (
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">Today</Link>
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            size="icon"
            aria-label="Next day"
            disabled={isToday}
          >
            <Link href={`/dashboard?date=${toDateParam(next, zone)}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Calories"
          value={totals.calories}
          unit="kcal"
          hint={`${totals.mealCount} meal${totals.mealCount === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Protein"
          value={totals.protein}
          unit="g"
          accent="var(--chart-protein)"
        />
        <StatTile
          label="Carbs"
          value={totals.carbs}
          unit="g"
          accent="var(--chart-carbs)"
        />
        <StatTile
          label="Fat"
          value={totals.fat}
          unit="g"
          accent="var(--chart-fat)"
        />
      </section>

      <section className="flex flex-wrap gap-2">
        <MealForm />
        <WorkoutForm
          trigger={
            <Button variant="outline" className="gap-2">
              Log workout
            </Button>
          }
        />
        <WeightForm
          defaultWeight={lastWeight?.weightKg ?? null}
          trigger={
            <Button variant="outline" className="gap-2">
              Check in
            </Button>
          }
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          Timeline
        </h2>
        <Timeline
          entries={entries}
          viewerId={user.id}
          timeZone={zone}
          isOwner
          canComment
          emptyState={
            <div className="space-y-1">
              <p className="text-sm font-medium">Nothing logged yet</p>
              <p className="text-sm text-muted-foreground">
                Snap your next meal — it takes about ten seconds.
              </p>
            </div>
          }
        />
      </section>
    </div>
  );
}
