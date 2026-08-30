import { MealForm } from "@/components/log/meal-form";
import { StatTile } from "@/components/timeline/macros";
import { ProcessingWatcher } from "@/components/timeline/processing-watcher";
import { Timeline } from "@/components/timeline/timeline";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { startOfDayLocal } from "@/lib/utils";
import { getSummary, type TimelineEntry } from "@/services/reporting";

export const metadata = { title: "Meals" };
// Meal and workout logging run transcription and analysis in after(), which
// counts toward this function's duration. 60s is the Vercel Hobby ceiling.
export const maxDuration = 60;

const DAYS = 14;

export default async function MealsPage() {
  const user = await requireUser();

  const from = startOfDayLocal(
    new Date(Date.now() - (DAYS - 1) * 24 * 60 * 60 * 1000),
  );

  const [meals, summary, pending] = await Promise.all([
    db.meal.findMany({
      where: { userId: user.id, eatenAt: { gte: from } },
      orderBy: { eatenAt: "desc" },
      include: {
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, name: true, image: true } },
          },
        },
      },
    }),
    getSummary(user.id, 7),
    db.meal.count({
      where: { userId: user.id, status: { in: ["PENDING", "PROCESSING"] } },
    }),
  ]);

  // Group into day buckets, newest first.
  const groups = new Map<string, typeof meals>();
  for (const meal of meals) {
    const key = startOfDayLocal(meal.eatenAt).toISOString();
    const bucket = groups.get(key);
    if (bucket) bucket.push(meal);
    else groups.set(key, [meal]);
  }

  return (
    <div className="space-y-6">
      <ProcessingWatcher initialPending={pending} />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The last {DAYS} days of logging.
          </p>
        </div>
        <MealForm />
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          7-day daily average
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Calories"
            value={summary.avgCalories}
            unit="kcal"
            hint={`${summary.totalMeals} meals logged`}
          />
          <StatTile
            label="Protein"
            value={summary.avgProtein}
            unit="g"
            accent="var(--chart-protein)"
          />
          <StatTile
            label="Carbs"
            value={summary.avgCarbs}
            unit="g"
            accent="var(--chart-carbs)"
          />
          <StatTile
            label="Fat"
            value={summary.avgFat}
            unit="g"
            accent="var(--chart-fat)"
          />
        </div>
      </section>

      {groups.size === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <p className="text-sm font-medium">No meals logged yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Photograph your next plate and say what&apos;s on it.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([key, dayMeals]) => {
            const day = new Date(key);
            const entries: TimelineEntry[] = dayMeals
              .slice()
              .sort((a, b) => a.eatenAt.getTime() - b.eatenAt.getTime())
              .map((m) => ({
                kind: "meal" as const,
                at: m.eatenAt,
                id: m.id,
                // Prisma's row shape matches TimelineMeal.
                data: m as unknown as Extract<
                  TimelineEntry,
                  { kind: "meal" }
                >["data"],
              }));

            const kcal = dayMeals.reduce((a, m) => a + (m.calories ?? 0), 0);
            const protein = dayMeals.reduce((a, m) => a + (m.protein ?? 0), 0);

            return (
              <section key={key}>
                <div className="mb-3 flex items-baseline justify-between border-b border-border pb-2">
                  <h2 className="text-sm font-semibold">
                    {day.toLocaleDateString(undefined, {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                  </h2>
                  <span className="tabular text-xs text-muted-foreground">
                    {Math.round(kcal)} kcal · {Math.round(protein)}g protein
                  </span>
                </div>

                <Timeline
                  entries={entries}
                  viewerId={user.id}
                  isOwner
                  canComment
                />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
