import { PremiumNotice } from "@/components/billing/premium-notice";
import { fillDays, WaterBars } from "@/components/charts/water-bars";
import { EmptyState, SectionHeading } from "@/components/layout/page";
import { WaterForm } from "@/components/log/water-form";
import { WaterQuickAdd } from "@/components/log/water-quick-add";
import { WaterGoalForm } from "@/components/settings/water-goal-form";
import { WaterActions } from "@/components/timeline/record-actions";
import { SegmentedLinks } from "@/components/ui/filter-pills";
import { BigStat } from "@/components/ui/metric";
import { db } from "@/lib/db";
import { FREE_HISTORY_DAYS } from "@/lib/entitlements";
import { formatWater, hydrationPct, litres, waterGoal } from "@/lib/hydration";
import { displayVolume } from "@/lib/units";
import { getUnits } from "@/services/units";
import { premiumStatus, requireUser } from "@/lib/session";
import { addDaysInZone, dayKeyInZone, safeZone } from "@/lib/tz";
import { cn } from "@/lib/utils";

export const metadata = { title: "Water" };

const RANGES = [
  { label: "14d", value: "14", days: 14, window: "fortnight" },
  { label: "30d", value: "30", days: 30, window: "30-day" },
  { label: "90d", value: "90", days: 90, window: "90-day" },
] as const;

/** What a free account sees, whatever the URL asks for. */
const FREE_RANGE = {
  label: "7d",
  value: "7",
  days: FREE_HISTORY_DAYS,
  window: "7-day",
} as const;

export default async function WaterPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireUser();
  const { range: rangeParam } = await searchParams;

  const { premium } = await premiumStatus(user.id);
  const zone = safeZone(user.timeZone);

  // As on Weight: a free account is pinned to the short window regardless of
  // ?range=, so every label below describes what is actually plotted.
  const range = premium
    ? (RANGES.find((r) => r.value === rangeParam) ?? RANGES[1])
    : FREE_RANGE;

  const today = dayKeyInZone(new Date(), zone);

  const floor = dayKeyInZone(
    addDaysInZone(new Date(), -(range.days - 1), zone),
    zone,
  );

  const [profile, entries, units] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: { waterGoalMl: true },
    }),
    // Read with their ids rather than through getWaterSeries: this page can
    // delete a day, and a row it cannot name is a row it cannot delete.
    db.waterEntry.findMany({
      where: { userId: user.id, day: { gte: floor } },
      orderBy: { day: "asc" },
      select: { id: true, day: true, ml: true },
    }),
    getUnits(user.id),
  ]);

  const unit = units.volume;
  const goalMl = waterGoal(profile?.waterGoalMl);

  /** Litres read better than four digits; ounces are already short. */
  const headline = (ml: number) =>
    unit === "FL_OZ" ? displayVolume(ml, unit) : litres(ml);
  const headlineUnit = unit === "FL_OZ" ? "fl oz" : "L";

  // Every day in the window gets a bar, logged or not — the gaps are the point.
  const days = Array.from({ length: range.days }, (_, i) =>
    dayKeyInZone(addDaysInZone(new Date(), -(range.days - 1 - i), zone), zone),
  );
  const bars = fillDays(entries, days);

  const todayMl = bars[bars.length - 1]?.ml ?? 0;
  const logged = bars.filter((b) => b.ml > 0);
  const avgMl = logged.length
    ? Math.round(logged.reduce((a, b) => a + b.ml, 0) / logged.length)
    : 0;
  const onTarget = bars.filter((b) => b.ml >= goalMl).length;

  // Counted back from yesterday, so a streak is not broken by a day that is
  // still being drunk. Today extends it the moment the goal is met.
  let streak = 0;
  for (let i = bars.length - 1; i >= 0; i--) {
    const met = bars[i].ml >= goalMl;
    if (i === bars.length - 1 && !met) continue;
    if (!met) break;
    streak += 1;
  }

  const history = [...bars].reverse().filter((b) => b.ml > 0);
  const idByDay = new Map(
    entries.map((e) => [e.day.toISOString().slice(0, 10), e.id]),
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-serif text-[28px] leading-none text-fg sm:text-[30px]">
            Water
          </h1>
          <p className="mt-2.5 text-[13px] text-fg-dim">
            Daily intake · {range.window} window
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {premium && (
            <SegmentedLinks
              active={range.value}
              options={RANGES.map((r) => ({
                label: r.label,
                value: r.value,
                href: `/dashboard/water?range=${r.value}`,
              }))}
            />
          )}
          <WaterForm defaultMl={todayMl || null} unit={unit} />
        </div>
      </div>

      {!premium && (
        <PremiumNotice
          title="Showing the last 7 days"
          body="Every glass you log is kept — Premium opens the fortnight, 30-day and 90-day windows behind it."
        />
      )}

      <section className="rounded-2xl border border-line-strong bg-surface px-7 py-6">
        <div className="flex flex-wrap items-start gap-x-11 gap-y-6">
          <BigStat
            label="Today"
            value={todayMl === 0 ? "0" : headline(todayMl)}
            unit={headlineUnit}
          />
          <BigStat
            label="Of goal"
            value={`${hydrationPct(todayMl, goalMl)}%`}
            tone={todayMl >= goalMl ? "blue" : "default"}
          />
          <BigStat
            label="Average logged day"
            value={avgMl === 0 ? "—" : headline(avgMl)}
            unit={avgMl === 0 ? undefined : headlineUnit}
          />
          <BigStat
            label="Days on target"
            value={`${onTarget}/${bars.length}`}
          />

          <div className="ml-auto max-w-[240px]">
            <p className="mono-label">Where this stands</p>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-fg-muted">
              {streak >= 2
                ? `${streak} days running at ${formatWater(goalMl, unit)} or more. That is the habit, not the day.`
                : todayMl >= goalMl
                  ? "Today is done. Do it again tomorrow and it starts counting as a streak."
                  : avgMl === 0
                    ? "Log a glass and the bars below start filling in."
                    : `You average ${formatWater(avgMl, unit)} on the days you log — ${
                        avgMl >= goalMl ? "at or above" : "short of"
                      } your ${formatWater(goalMl, unit)} goal.`}
            </p>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3">
          <WaterQuickAdd unit={unit} />
        </div>

        <WaterBars
          points={bars}
          goalMl={goalMl}
          unit={unit}
          className="mt-6"
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
        <section className="flex min-w-0 flex-col gap-3.5">
          <SectionHeading meta={`${logged.length} days logged`}>
            Daily history
          </SectionHeading>

          {history.length === 0 ? (
            <EmptyState
              title="No water logged yet"
              body="A glass is one tap, and the day's total is the only number this keeps. Nobody needs a form for a drink of water."
              action={<WaterQuickAdd unit={unit} />}
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {history.map((entry, i) => {
                const key = entry.day.toISOString().slice(0, 10);
                const met = entry.ml >= goalMl;
                const isToday = key === today.toISOString().slice(0, 10);
                const id = idByDay.get(key);

                return (
                  <li
                    key={key}
                    className={cn(
                      "flex items-center gap-4 rounded-xl border px-4 py-3",
                      i === 0
                        ? "border-line-strong bg-surface"
                        : "border-line bg-surface-muted",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-[13px] font-medium",
                          i === 0 ? "text-fg" : "text-fg-muted",
                        )}
                      >
                        {isToday
                          ? "Today"
                          : entry.day.toLocaleDateString(undefined, {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              timeZone: "UTC",
                            })}
                      </p>
                      <div className="mt-1.5 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-track">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            met ? "bg-blue" : "bg-blue/45",
                          )}
                          style={{ width: `${hydrationPct(entry.ml, goalMl)}%` }}
                        />
                      </div>
                    </div>

                    <span
                      className={cn(
                        "tabular w-[46px] shrink-0 text-right font-mono text-[11.5px]",
                        met ? "text-blue-text" : "text-fg-dim",
                      )}
                    >
                      {hydrationPct(entry.ml, goalMl)}%
                    </span>

                    <span className="tabular shrink-0 font-mono text-[13px] text-fg">
                      {formatWater(entry.ml, unit)}
                    </span>

                    {id && <WaterActions entryId={id} />}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-5">
          <div className="rounded-2xl border border-line p-[18px]">
            <p className="text-[12.5px] font-semibold text-fg">Your goal</p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-fg-dim">
              What every bar and percentage on this page is measured against.
            </p>
            <div className="mt-3.5">
              <WaterGoalForm
                goalMl={profile?.waterGoalMl ?? null}
                unit={unit}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-line p-[18px]">
            <p className="text-[12.5px] font-semibold text-fg">
              How this is counted
            </p>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-fg-dim">
              One total per day, in your own timezone — {safeZone(user.timeZone)}.
              A glass logged at one in the morning belongs to the night before
              only if that is still the same day where you are.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
