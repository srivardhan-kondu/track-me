import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { EmptyState } from "@/components/layout/page";
import { MealRow } from "@/components/meals/meal-row";
import { MacroRow, MacroSplitBar } from "@/components/timeline/macros";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  endOfDayInZone,
  formatDateInZone,
  formatTimeInZone,
  fromDateParam,
  isSameDayInZone,
  safeZone,
  startOfDayInZone,
} from "@/lib/tz";
import type { TimelineMeal } from "@/services/reporting";
import { mediaUrl } from "@/services/storage";

export const metadata = { title: "Meals" };

/**
 * Everything eaten on one day.
 *
 * The meals page shows a finished day as a single total; this is what opens
 * when somebody wants the plates behind it. The individual meal pages are one
 * more tap from here, which is the same three-step shape the training side
 * has: how the period went, then the day, then the thing itself.
 */
export default async function MealDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date: dateParam } = await params;
  const user = await requireUser();
  const zone = safeZone(user.timeZone);

  const day = fromDateParam(dateParam, zone);
  const from = startOfDayInZone(day, zone);
  const to = endOfDayInZone(day, zone);

  const meals = await db.meal.findMany({
    where: { userId: user.id, eatenAt: { gte: from, lte: to } },
    orderBy: { eatenAt: "desc" },
    include: {
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, image: true } } },
      },
    },
  });

  const resolved = await Promise.all(
    meals.map(async (meal) => ({
      meal: meal as unknown as TimelineMeal,
      imageUrl: await mediaUrl(meal.imageKey),
    })),
  );

  const totals = meals.reduce(
    (a, m) => ({
      calories: a.calories + (m.calories ?? 0),
      protein: a.protein + (m.protein ?? 0),
      carbs: a.carbs + (m.carbs ?? 0),
      fat: a.fat + (m.fat ?? 0),
      // Null until some meal carries a figure — an unknown total, not a zero.
      // `== null` so a missing field cannot turn the total into NaN.
      fiber: m.fiber == null ? a.fiber : (a.fiber ?? 0) + m.fiber,
    }),
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: null as number | null,
    },
  );

  const isToday = isSameDayInZone(day, new Date(), zone);

  return (
    <>
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/meals"
          aria-label="Back to meals"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-strong text-fg-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </Link>
        <p className="mono-label">Day detail</p>
      </div>

      <header>
        <h1 className="font-serif text-[26px] leading-none text-fg sm:text-[30px]">
          {isToday
            ? "Today"
            : formatDateInZone(day, zone, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
        </h1>
        <p className="mt-2.5 text-[13px] text-fg-dim">
          {formatDateInZone(day, zone, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          {" · "}
          {meals.length} meal{meals.length === 1 ? "" : "s"}
        </p>
      </header>

      {meals.length === 0 ? (
        <EmptyState
          title="Nothing logged that day"
          body="No meals were recorded here."
        />
      ) : (
        <>
          <div className="metric-strip">
            <Figure label="Calories" value={Math.round(totals.calories)} />
            <Figure label="Protein" value={Math.round(totals.protein)} unit="g" />
            <Figure label="Carbs" value={Math.round(totals.carbs)} unit="g" />
            <Figure label="Fat" value={Math.round(totals.fat)} unit="g" />
            {totals.fiber !== null && (
              <Figure label="Fibre" value={Math.round(totals.fiber)} unit="g" />
            )}
          </div>

          <div className="rounded-2xl border border-line bg-surface px-6 py-5">
            <h2 className="text-[13px] font-semibold text-fg">Macro split</h2>
            <MacroSplitBar macros={totals} className="mt-4" />
            <MacroRow macros={totals} className="mt-3.5" />
          </div>

          <div className="flex flex-col gap-2.5">
            {resolved.map(({ meal, imageUrl }) => (
              <MealRow
                key={meal.id}
                meal={meal}
                imageUrl={imageUrl}
                time={formatTimeInZone(meal.eatenAt, zone)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Figure({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit?: string;
}) {
  return (
    <div className="px-5 py-4">
      <p className="mono-label">{label}</p>
      <p className="tabular mt-1.5 text-[19px] font-extrabold leading-none text-fg">
        {value.toLocaleString()}
        {unit && (
          <span className="ml-1 text-[12px] font-semibold text-fg-dim">
            {unit}
          </span>
        )}
      </p>
    </div>
  );
}
