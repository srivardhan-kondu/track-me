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
import { startOfDayLocal } from "@/lib/utils";
import { getDayTimeline, getDayTotals } from "@/services/reporting";

export const metadata = { title: "Today" };

function parseDate(value?: string): Date {
  if (!value) return new Date();
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toParam(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const { date: dateParam } = await searchParams;

  const date = parseDate(dateParam);
  const isToday =
    startOfDayLocal(date).getTime() === startOfDayLocal(new Date()).getTime();

  const [entries, totals, pending, lastWeight] = await Promise.all([
    getDayTimeline(user.id, date),
    getDayTotals(user.id, date),
    db.meal.count({
      where: { userId: user.id, status: { in: ["PENDING", "PROCESSING"] } },
    }),
    db.weightEntry.findFirst({
      where: { userId: user.id },
      orderBy: { day: "desc" },
      select: { weightKg: true },
    }),
  ]);

  const prev = new Date(date);
  prev.setDate(prev.getDate() - 1);
  const next = new Date(date);
  next.setDate(next.getDate() + 1);

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
            {date.toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon" aria-label="Previous day">
            <Link href={`/dashboard?date=${toParam(prev)}`}>
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
            <Link href={`/dashboard?date=${toParam(next)}`}>
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
