import Link from "next/link";
import { ChevronRight, Flame, Scale, Users } from "lucide-react";

import { AddAthlete } from "@/components/trainer/add-athlete";
import { RemoveAthlete } from "@/components/trainer/remove-athlete";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireCoach } from "@/lib/session";
import { initials } from "@/lib/utils";
import { getCoachRoster } from "@/services/reporting";

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

export default async function TrainerPage() {
  const coach = await requireCoach();
  const roster = await getCoachRoster(coach.id);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Athletes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {roster.length === 0
              ? "No athletes yet."
              : `${roster.length} athlete${roster.length === 1 ? "" : "s"} on your roster.`}
          </p>
        </div>
        <AddAthlete />
      </header>

      {roster.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Your roster is empty</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Add an athlete by the email they signed up with. Their meals,
            workouts and weigh-ins will appear here as they log them.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {roster.map(({ athlete, summary, todayTotals, lastLoggedAt }) => {
            const tone = complianceTone(
              summary.mealComplianceDays,
              summary.daysElapsed,
            );

            return (
              <Card key={athlete.id}>
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <Avatar className="h-11 w-11">
                    {athlete.image && <AvatarImage src={athlete.image} alt="" />}
                    <AvatarFallback>
                      {initials(athlete.name, athlete.email)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">
                        {athlete.name ?? athlete.email}
                      </p>
                      <Badge variant={tone.variant}>{tone.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {relativeDays(lastLoggedAt)} ·{" "}
                      {summary.mealComplianceDays}/{summary.daysElapsed} days
                      logged this week
                    </p>
                  </div>

                  <dl className="tabular grid grid-cols-3 gap-4 text-sm sm:gap-6">
                    <div>
                      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Flame className="h-3 w-3" />
                        Today
                      </dt>
                      <dd className="mt-0.5 font-semibold">
                        {todayTotals.calories}
                        <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                          kcal
                        </span>
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Avg protein
                      </dt>
                      <dd className="mt-0.5 font-semibold">
                        {summary.avgProtein}
                        <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                          g
                        </span>
                      </dd>
                    </div>

                    <div>
                      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Scale className="h-3 w-3" />
                        Weight
                      </dt>
                      <dd className="mt-0.5 font-semibold">
                        {summary.endWeightKg ?? "—"}
                        {summary.weightChangeKg !== null && (
                          <span
                            className={
                              summary.weightChangeKg > 0
                                ? "ml-1 text-xs font-normal text-[var(--warning)]"
                                : "ml-1 text-xs font-normal text-[var(--success)]"
                            }
                          >
                            {summary.weightChangeKg > 0 ? "+" : ""}
                            {summary.weightChangeKg}
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex items-center gap-1">
                    <RemoveAthlete athleteId={athlete.id} />
                    <Link
                      href={`/trainer/${athlete.id}`}
                      className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-accent"
                    >
                      Review
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
