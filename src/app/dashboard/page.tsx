import { DaySwitcher } from "@/components/dashboard/day-switcher";
import { FuelPanel } from "@/components/dashboard/fuel-panel";
import { HydrationCard } from "@/components/dashboard/hydration-card";
import { DashboardHero } from "@/components/dashboard/hero";
import {
  CoachNoteCard,
  ConsistencyCard,
  WeightRailCard,
} from "@/components/dashboard/rail";
import { EmptyState } from "@/components/layout/page";
import { MealForm } from "@/components/log/meal-form";
import { WeightForm } from "@/components/log/weight-form";
import { WorkoutForm } from "@/components/log/workout-form";
import { InstallBanner } from "@/components/pwa/install-button";
import { ProcessingWatcher } from "@/components/timeline/processing-watcher";
import { Timeline } from "@/components/timeline/timeline";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { PremiumNotice } from "@/components/billing/premium-notice";
import { FREE_HISTORY_DAYS, historyDays, trialLapsed } from "@/lib/entitlements";
import { waterGoal } from "@/lib/hydration";
import { premiumStatus, requireUser } from "@/lib/session";
import {
  addDaysInZone,
  formatDateInZone,
  fromDateParam,
  hourInZone,
  isSameDayInZone,
  safeZone,
  startOfDayInZone,
  toDateParam,
} from "@/lib/tz";
import {
  getCompliance,
  getDayTimeline,
  getDayTotals,
  getLatestCoachNote,
  getSummary,
  getWeekFigures,
  getWeightSeries,
} from "@/services/reporting";

export const metadata = { title: "Today" };
// Meal and workout logging run transcription and analysis in after(), which
// counts toward this function's duration. 60s is the Vercel Hobby ceiling.
export const maxDuration = 60;

const RAIL_DAYS = 30;

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const { date: dateParam } = await searchParams;

  const status = await premiumStatus(user.id);
  const { premium } = status;
  // Somebody who has seen Premium work is a different conversation from
  // somebody who never has, so the notice asks which of the two this is.
  const lapsed = trialLapsed(status);

  const zone = safeZone(user.timeZone);
  const railDays = historyDays(premium, RAIL_DAYS);

  // ?date= is user input, so the free window has to be enforced here and not
  // only in the day switcher's arrows.
  const requested = fromDateParam(dateParam, zone);
  const earliest = startOfDayInZone(
    addDaysInZone(new Date(), -(FREE_HISTORY_DAYS - 1), zone),
    zone,
  );
  const date = premium || requested >= earliest ? requested : earliest;
  const isToday = isSameDayInZone(date, new Date(), zone);

  const [
    entries,
    totals,
    summary,
    series,
    compliance,
    note,
    pending,
    lastWeight,
    week,
    profile,
  ] = await Promise.all([
      getDayTimeline(user.id, date, zone),
      getDayTotals(user.id, date, zone),
      getSummary(user.id, 7, zone),
      getWeightSeries(user.id, railDays, zone),
      getCompliance(user.id, 7, zone),
      getLatestCoachNote(user.id),
      db.meal.count({
        where: { userId: user.id, status: { in: ["PENDING", "PROCESSING"] } },
      }),
      db.weightEntry.findFirst({
        where: { userId: user.id },
        orderBy: { day: "desc" },
        select: { weightKg: true },
      }),
      getWeekFigures(user.id, 7, zone),
      db.user.findUnique({
        where: { id: user.id },
        select: { gender: true, waterGoalMl: true },
      }),
    ]);

  const prev = addDaysInZone(date, -1, zone);
  const next = addDaysInZone(date, 1, zone);

  const firstName = user.name?.split(" ")[0] ?? "there";
  const hour = hourInZone(new Date(), zone);

  /*
    The hero ring reports how much of the week was actually logged: each day
    can score a meal, a workout and a weigh-in, and the ring is what share of
    those the athlete filled in.
  */
  const slots = compliance.length * 3;
  const filled = compliance.reduce(
    (n, d) =>
      n + (d.meals > 0 ? 1 : 0) + (d.workouts > 0 ? 1 : 0) + (d.weighedIn ? 1 : 0),
    0,
  );
  const consistencyPct = slots > 0 ? Math.round((filled / slots) * 100) : 0;

  // A genuine day one: nothing logged, ever.
  const dayOne =
    entries.length === 0 && summary.totalMeals === 0 && series.length === 0;

  return (
    <>
      <ProcessingWatcher initialPending={pending} />

      {isToday ? (
        <DashboardHero
          greeting={greeting(hour)}
          name={firstName}
          gender={profile?.gender ?? null}
          consistencyPct={consistencyPct}
          week={week}
        />
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="mono-label mb-2.5">
              {formatDateInZone(date, zone, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </p>
            <h1 className="font-serif text-[28px] leading-none text-fg sm:text-[33px]">
              That day
            </h1>
          </div>
        </div>
      )}


      <FuelPanel
        totals={totals}
        label={isToday ? "Eaten today" : "Eaten that day"}
        baseline={{
          calories: summary.avgCalories,
          protein: summary.avgProtein,
          carbs: summary.avgCarbs,
          fat: summary.avgFat,
          days: summary.daysElapsed,
        }}
      />

      {!premium && (
        <PremiumNotice
          title={
            lapsed
              ? "Your trial has ended"
              : `You are seeing the last ${FREE_HISTORY_DAYS} days`
          }
          body={
            lapsed
              ? `Everything you logged during the trial is still here, untouched — this page just stops ${FREE_HISTORY_DAYS} days back, meals are estimated rather than read, and progress photos are paused. Premium brings all of it back.`
              : "Premium opens your whole history, reads your meal photographs properly, and adds progress photos, strength charts and export."
          }
          cta={lapsed ? "Pick up where you left off" : undefined}
        />
      )}

      <InstallBanner />

      <div className="flex flex-wrap items-center gap-2.5">
        <MealForm />
        <WorkoutForm
          trigger={<Button variant="outline">Log workout</Button>}
        />
        <WeightForm
          defaultWeight={lastWeight?.weightKg ?? null}
          trigger={<Button variant="outline">Weigh in</Button>}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-start">
        <section className="flex min-w-0 flex-col gap-3.5">
          {/*
            The day switcher lives on the timeline it actually controls, rather
            than floating in its own row above the page.
          */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[12.5px] font-semibold text-fg">Timeline</h2>
            <DaySwitcher
              prevHref={`/dashboard?date=${toDateParam(prev, zone)}`}
              todayHref="/dashboard"
              nextHref={`/dashboard?date=${toDateParam(next, zone)}`}
              isToday={isToday}
            />
          </div>

          <Timeline
            entries={entries}
            viewerId={user.id}
            timeZone={zone}
            isOwner
            canComment
            upsell={!premium}
            emptyState={
              dayOne ? (
                <EmptyState
                  title={`Hey ${firstName}`}
                  body="Three things get Track Me useful. The first takes ten seconds."
                  steps={[
                    {
                      title: "Say what you ate",
                      body: "Hold the button and talk. Macros get filled in for you.",
                    },
                    {
                      title: "Step on the scale",
                      body: "One number today becomes your baseline.",
                    },
                    {
                      title: "Invite your coach",
                      body: "They see your timeline and leave notes on it.",
                    },
                  ]}
                  className="border-0 p-0"
                />
              ) : (
                <div>
                  <p className="font-serif text-lg text-fg">
                    Nothing logged {isToday ? "yet today" : "that day"}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-fg-dim">
                    {isToday
                      ? "Snap your next meal — it takes about ten seconds."
                      : "Days you miss change nothing. The trend is what matters."}
                  </p>
                </div>
              )
            }
          />
        </section>

        <aside className="flex flex-col gap-3.5">
          <HydrationCard
            ml={totals.waterMl}
            goalMl={waterGoal(profile?.waterGoalMl)}
            // Quick adds follow the day being viewed, so catching up on
            // yesterday from its own timeline logs it to yesterday.
            day={isToday ? undefined : toDateParam(date, zone)}
          />
          <WeightRailCard points={series} days={railDays} />
          <ConsistencyCard days={compliance} />
          {note && <CoachNoteCard note={note} />}
        </aside>
      </div>
    </>
  );
}
