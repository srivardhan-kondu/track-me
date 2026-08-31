import { ComplianceStrip } from "@/components/charts/compliance-strip";
import { WeightChart } from "@/components/charts/weight-chart";
import { WeightForm } from "@/components/log/weight-form";
import { StatTile } from "@/components/timeline/macros";
import { WeightActions } from "@/components/timeline/record-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { safeZone } from "@/lib/tz";
import { round } from "@/lib/utils";
import { getCompliance, getWeightSeries } from "@/services/reporting";
import { mediaUrl } from "@/services/storage";

export const metadata = { title: "Weight" };

export default async function WeightPage() {
  const user = await requireUser();

  const zone = safeZone(user.timeZone);

  const [series, compliance, entries] = await Promise.all([
    getWeightSeries(user.id, 90, zone),
    getCompliance(user.id, 14, zone),
    db.weightEntry.findMany({
      where: { userId: user.id },
      orderBy: { day: "desc" },
      take: 30,
    }),
  ]);

  const withPhotos = await Promise.all(
    entries.map(async (e) => ({ ...e, photoUrl: await mediaUrl(e.photoKey) })),
  );

  const latest = series[series.length - 1]?.weightKg ?? null;
  const first = series[0]?.weightKg ?? null;
  const change =
    latest !== null && first !== null && series.length > 1
      ? round(latest - first, 1)
      : null;

  // Compare the last 7 days against the 7 before to smooth daily noise.
  const recent = series.slice(-7);
  const prior = series.slice(-14, -7);
  const avg = (xs: typeof series) =>
    xs.length ? xs.reduce((a, p) => a + p.weightKg, 0) / xs.length : null;
  const recentAvg = avg(recent);
  const priorAvg = avg(prior);
  const weeklyTrend =
    recentAvg !== null && priorAvg !== null
      ? round(recentAvg - priorAvg, 2)
      : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Weight</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Daily morning check-ins over the last 90 days.
          </p>
        </div>
        <WeightForm defaultWeight={latest} />
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Current"
          value={latest ?? "—"}
          unit={latest !== null ? "kg" : undefined}
        />
        <StatTile
          label="Change"
          value={change !== null ? (change > 0 ? `+${change}` : change) : "—"}
          unit={change !== null ? "kg" : undefined}
          hint="over the window"
        />
        <StatTile
          label="Weekly trend"
          value={
            weeklyTrend !== null
              ? weeklyTrend > 0
                ? `+${weeklyTrend}`
                : weeklyTrend
              : "—"
          }
          unit={weeklyTrend !== null ? "kg" : undefined}
          hint="vs previous 7 days"
        />
        <StatTile label="Check-ins" value={series.length} hint="last 90 days" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <WeightChart points={series} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logging consistency</CardTitle>
        </CardHeader>
        <CardContent>
          <ComplianceStrip days={compliance} />
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          Check-in history
        </h2>

        {withPhotos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <p className="text-sm font-medium">No check-ins yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Weigh in tomorrow morning to start the trend.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {withPhotos.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 p-3">
                {entry.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.photoUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded-lg bg-muted" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {new Date(entry.day).toLocaleDateString(undefined, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "UTC",
                    })}
                  </p>
                  {entry.notes && (
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.notes}
                    </p>
                  )}
                </div>

                <span className="tabular shrink-0 text-sm font-semibold">
                  {entry.weightKg} kg
                </span>

                <WeightActions entryId={entry.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
