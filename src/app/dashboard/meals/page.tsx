import { PremiumNotice } from "@/components/billing/premium-notice";
import { DayDivider, EmptyState } from "@/components/layout/page";
import { MealForm } from "@/components/log/meal-form";
import { DayCard } from "@/components/meals/day-card";
import { MealRow } from "@/components/meals/meal-row";
import { ProcessingWatcher } from "@/components/timeline/processing-watcher";
import { FilterPills } from "@/components/ui/filter-pills";
import { Metric, MetricStrip } from "@/components/ui/metric";
import { db } from "@/lib/db";
import { premiumStatus, requireUser } from "@/lib/session";
import {
  addDaysInZone,
  formatDateInZone,
  formatTimeInZone,
  fromDateParam,
  isSameDayInZone,
  safeZone,
  startOfDayInZone,
  toDateParam,
} from "@/lib/tz";
import { getSummary, type TimelineMeal } from "@/services/reporting";
import { mediaUrl } from "@/services/storage";

export const metadata = { title: "Meals" };
// Meal and workout logging run transcription and analysis in after(), which
// counts toward this function's duration. 60s is the Vercel Hobby ceiling.
export const maxDuration = 60;

const DAYS = 14;

const SLOTS = [
  { label: "All", value: null },
  { label: "Breakfast", value: "BREAKFAST" },
  { label: "Lunch", value: "LUNCH" },
  { label: "Dinner", value: "DINNER" },
  { label: "Snack", value: "SNACK" },
] as const;

export default async function MealsPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string }>;
}) {
  const user = await requireUser();
  const { slot: slotParam } = await searchParams;

  const { premium } = await premiumStatus(user.id);

  const slot =
    SLOTS.find((s) => s.value && s.value === slotParam)?.value ?? null;

  const zone = safeZone(user.timeZone);
  const from = startOfDayInZone(
    addDaysInZone(new Date(), -(DAYS - 1), zone),
    zone,
  );

  const [meals, summary, pending] = await Promise.all([
    db.meal.findMany({
      where: {
        userId: user.id,
        eatenAt: { gte: from },
        ...(slot ? { slot } : {}),
      },
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
    getSummary(user.id, 7, zone),
    db.meal.count({
      where: { userId: user.id, status: { in: ["PENDING", "PROCESSING"] } },
    }),
  ]);

  // Signed media URLs have to be resolved on the server. Only the thumbnail
  // is needed here — the voice note is played on the meal's own page, so this
  // list no longer signs a second URL per row that nothing renders.
  const resolved = await Promise.all(
    meals.map(async (meal) => ({
      meal: meal as unknown as TimelineMeal,
      imageUrl: await mediaUrl(meal.imageKey),
    })),
  );

  // Group into day buckets, newest first.
  const groups = new Map<string, typeof resolved>();
  for (const row of resolved) {
    const key = toDateParam(row.meal.eatenAt, zone);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  const perDay =
    summary.mealComplianceDays > 0
      ? Math.round((summary.totalMeals / summary.mealComplianceDays) * 10) / 10
      : 0;

  const pillHref = (value: string | null) =>
    value ? `/dashboard/meals?slot=${value}` : "/dashboard/meals";

  return (
    <>
      <ProcessingWatcher initialPending={pending} />

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-serif text-[28px] leading-none text-fg sm:text-[30px]">
            Meals
          </h1>
          <p className="mt-2.5 text-[13px] text-fg-dim">
            Last {DAYS} days
            {perDay > 0 && ` · ${perDay} meals a day on average`}
          </p>
        </div>

        <MealForm />
      </div>

      {!premium && (
        <PremiumNotice
          title="These macros are estimated, not analysed"
          body="On the free plan a meal is matched against a word list — it never reaches the model. Premium reads the photograph itself and returns the breakdown per ingredient, and turns a spoken note into a logged meal without you typing anything."
        />
      )}

      <MetricStrip>
        <Metric
          label="Daily calories"
          value={summary.avgCalories.toLocaleString()}
          note="7-day average"
        />
        <Metric label="Protein" value={summary.avgProtein} unit="g / day" />
        <Metric label="Carbs" value={summary.avgCarbs} unit="g / day" />
        <Metric label="Fat" value={summary.avgFat} unit="g / day" />
      </MetricStrip>

      <FilterPills
        active={slot}
        options={SLOTS.map((s) => ({
          label: s.label,
          value: s.value,
          href: pillHref(s.value),
        }))}
      />

      {groups.size === 0 ? (
        <EmptyState
          title={slot ? "Nothing in this slot yet" : "No meals logged yet"}
          body={
            slot
              ? "Try another part of the day, or log one now."
              : "Photograph your next plate and say what's on it — the macros get filled in for you."
          }
          action={<MealForm />}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {[...groups.entries()].map(([key, rows]) => {
            const day = fromDateParam(key, zone);
            const isToday = isSameDayInZone(day, new Date(), zone);

            const totals = rows.reduce(
              (a, r) => ({
                calories: a.calories + (r.meal.calories ?? 0),
                protein: a.protein + (r.meal.protein ?? 0),
                carbs: a.carbs + (r.meal.carbs ?? 0),
                fat: a.fat + (r.meal.fat ?? 0),
                /*
                  Stays null until some meal that day actually has a figure,
                  so a day of offline estimates reads as unknown, not as zero.

                  `== null` rather than `=== null` on purpose: this reduce runs
                  over a value that reached here through a cast, and a missing
                  field would otherwise be added as undefined and turn the
                  whole day's total into NaN.
                */
                fiber:
                  r.meal.fiber == null ? a.fiber : (a.fiber ?? 0) + r.meal.fiber,
              }),
              {
                calories: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
                fiber: null as number | null,
              },
            );

            /*
              A day that is over is one card. Nobody scrolling a fortnight back
              is reading what they had at 4pm three Tuesdays ago plate by
              plate — they want to know whether the day landed, and the plates
              are one tap away for the day they actually have a question about.
            */
            if (!isToday) {
              return (
                <DayCard
                  key={key}
                  href={`/dashboard/meals/day/${key}`}
                  label={formatDateInZone(day, zone, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                  meals={rows.length}
                  totals={totals}
                />
              );
            }

            // Today is still being written, and a running total is not much
            // use until it is finished — so it stays open.
            return (
              <section key={key} className="flex flex-col gap-2.5">
                <DayDivider
                  label={`Today · ${formatDateInZone(day, zone, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}`}
                  meta={`${Math.round(totals.calories).toLocaleString()} kcal · ${Math.round(totals.protein)} p`}
                />

                {rows
                  .slice()
                  .sort(
                    (a, b) =>
                      b.meal.eatenAt.getTime() - a.meal.eatenAt.getTime(),
                  )
                  .map(({ meal, imageUrl }) => (
                    <MealRow
                      key={meal.id}
                      meal={meal}
                      imageUrl={imageUrl}
                      time={formatTimeInZone(meal.eatenAt, zone)}
                    />
                  ))}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
