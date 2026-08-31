import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { EmptyState } from "@/components/layout/page";
import { AddAthlete } from "@/components/trainer/add-athlete";
import { RemoveAthlete } from "@/components/trainer/remove-athlete";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { requireCoach } from "@/lib/session";
import {
  displayWeight,
  formatWeightDelta,
  unitPrefs,
  weightLabel,
} from "@/lib/units";
import { cn, initials } from "@/lib/utils";
import { getCoachRoster, getPendingRequests } from "@/services/reporting";

export const metadata = { title: "Coach dashboard" };

function relativeDays(date: Date | null): string {
  if (!date) return "Never logged";
  const hours = (Date.now() - date.getTime()) / 36e5;
  if (hours < 1) return "Logged just now";
  if (hours < 24) return `Logged ${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  return `Logged ${days}d ago`;
}

/** Turns compliance into a traffic light the coach can scan at a glance. */
function complianceTone(days: number, total: number) {
  const ratio = total > 0 ? days / total : 0;
  if (ratio >= 0.8) return { variant: "success" as const, label: "On track" };
  if (ratio >= 0.5) return { variant: "warning" as const, label: "Patchy" };
  return { variant: "destructive" as const, label: "Falling off" };
}

function Figure({
  label,
  value,
  unit,
  delta,
  deltaTone,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  delta?: React.ReactNode;
  deltaTone?: "sage" | "accent";
}) {
  return (
    // Fixed width so the columns line up down the roster.
    <div className="w-[104px]">
      <p className="mono-label">{label}</p>
      <p className="tabular mt-1.5 text-[15px] font-semibold text-fg">
        {value}
        {unit && (
          <span className="ml-1 font-mono text-[10.5px] font-normal text-fg-dim">
            {unit}
          </span>
        )}
        {delta && (
          <span
            className={cn(
              "ml-1.5 font-mono text-[10.5px] font-normal",
              deltaTone === "sage" ? "text-sage-text" : "text-accent-text",
            )}
          >
            {delta}
          </span>
        )}
      </p>
    </div>
  );
}

export default async function TrainerPage() {
  const coach = await requireCoach();
  const [roster, pending] = await Promise.all([
    getCoachRoster(coach.id),
    getPendingRequests(coach.id),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-serif text-[28px] leading-none text-fg sm:text-[30px]">
            Athletes
          </h1>
          <p className="mt-2.5 text-[13px] text-fg-dim">
            {roster.length === 0
              ? "No athletes yet."
              : `${roster.length} athlete${roster.length === 1 ? "" : "s"} on your roster · last 7 days`}
          </p>
        </div>

        <AddAthlete />
      </div>

      {pending.length > 0 && (
        <section className="rounded-2xl border border-line-strong bg-surface p-5">
          <p className="mono-label">Waiting on the athlete</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-fg-muted">
            You will see nothing of their training until they allow it. Ask them
            to check Settings on their own account.
          </p>
          <ul className="mt-3.5 flex flex-col gap-2">
            {pending.map(({ athlete }) => (
              <li
                key={athlete.id}
                className="flex items-center gap-3 border-t border-line pt-2.5 first:border-0 first:pt-0"
              >
                <Avatar className="h-8 w-8">
                  {athlete.image && <AvatarImage src={athlete.image} alt="" />}
                  <AvatarFallback className="text-[11px]">
                    {initials(athlete.name, athlete.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-fg">
                    {athlete.name ?? athlete.email}
                  </p>
                </div>
                <Badge variant="warning">Pending</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {roster.length === 0 ? (
        <EmptyState
          title="Your roster is empty"
          body="Request access using the email an athlete signed up with. Once they allow it, their meals, workouts and weigh-ins appear here as they log them — and you can leave a note on any of it."
          action={<AddAthlete />}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {roster.map(({ athlete, summary, todayTotals, lastLoggedAt }) => {
            const tone = complianceTone(
              summary.mealComplianceDays,
              summary.daysElapsed,
            );
            // Read in the athlete's unit, not the coach's: these are their
            // figures, and a coach who converts in their head misreads them.
            const unit = unitPrefs(athlete).weight;

            return (
              <div
                key={athlete.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-[14px] border border-line-strong bg-surface p-4"
              >
                <Avatar className="h-11 w-11">
                  {athlete.image && <AvatarImage src={athlete.image} alt="" />}
                  <AvatarFallback className="text-[11px]">
                    {initials(athlete.name, athlete.email)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <p className="truncate text-[13.5px] font-semibold text-fg">
                      {athlete.name ?? athlete.email}
                    </p>
                    <Badge variant={tone.variant}>{tone.label}</Badge>
                  </div>
                  <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-fg-dim">
                    {relativeDays(lastLoggedAt)} ·{" "}
                    {summary.mealComplianceDays}/{summary.daysElapsed} days
                    logged
                  </p>
                </div>

                <div className="flex gap-4">
                  <Figure
                    label="Today"
                    value={todayTotals.calories.toLocaleString()}
                    unit="kcal"
                  />
                  <Figure
                    label="Avg protein"
                    value={summary.avgProtein}
                    unit="g"
                  />
                  <Figure
                    label="Weight"
                    value={
                      summary.endWeightKg !== null
                        ? displayWeight(summary.endWeightKg, unit)
                        : "—"
                    }
                    unit={
                      summary.endWeightKg !== null ? weightLabel(unit) : undefined
                    }
                    delta={
                      summary.weightChangeKg !== null
                        ? formatWeightDelta(summary.weightChangeKg, unit)
                        : undefined
                    }
                    deltaTone={
                      summary.weightChangeKg !== null &&
                      summary.weightChangeKg <= 0
                        ? "sage"
                        : "accent"
                    }
                  />
                </div>

                <div className="flex items-center gap-1">
                  <RemoveAthlete athleteId={athlete.id} />
                  <Link
                    href={`/trainer/${athlete.id}`}
                    className="flex items-center gap-1 rounded-[9px] px-2.5 py-2 text-[12.5px] font-medium text-accent-text transition-colors hover:bg-hover"
                  >
                    Review
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
