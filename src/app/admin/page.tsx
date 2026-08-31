import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Clock,
  Coins,
} from "lucide-react";

import { Panel, StatusDot } from "@/components/admin/panel";
import { StackedBar, TrendChart } from "@/components/admin/trend";
import { PageHeader } from "@/components/layout/page";
import { Metric, MetricStrip } from "@/components/ui/metric";
import { budgetHealth, inr, inrShort, queueHealth } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { getOverview, getTrends } from "@/services/admin";

export const metadata = { title: "Overview" };

/** Change against the period before it, in the only form that reads quickly. */
function Delta({ now, before }: { now: number; before: number }) {
  if (before === 0) return now > 0 ? <>new</> : <>—</>;
  const change = Math.round(((now - before) / before) * 100);
  if (change === 0) return <>level</>;
  return <>{change > 0 ? `+${change}%` : `${change}%`}</>;
}

/** One thing that needs a person, with the page that fixes it. */
function Attention({
  icon,
  children,
  href,
  cta,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  href: string;
  cta: string;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-clay-line/60 py-2.5 last:border-0">
      <span className="text-clay-text">{icon}</span>
      <span className="min-w-0 flex-1 text-[12.5px] text-fg">{children}</span>
      <Link
        href={href}
        className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-clay-text hover:underline"
      >
        {cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </li>
  );
}

export default async function AdminOverviewPage() {
  const [overview, trends] = await Promise.all([getOverview(), getTrends(30)]);
  const { users, accounts, revenue, activity, queue, content, coaching, ai } =
    overview;

  const queueState = queueHealth(queue);
  const budget = ai ? budgetHealth(ai.spentUsd, ai.budgetUsd) : null;

  // Only the things a person has to do something about. An empty list is the
  // normal state, and showing an empty "alerts" panel every day is how a real
  // alert stops being read.
  const attention = [
    revenue.unmatched > 0 && (
      <Attention
        key="unmatched"
        icon={<Coins className="h-4 w-4" />}
        href="/admin/payments?status=UNMATCHED"
        cta="Attribute"
      >
        <strong className="font-semibold">{revenue.unmatched}</strong> payment
        {revenue.unmatched === 1 ? " has" : "s have"} been taken without being
        credited to an account.
      </Attention>
    ),
    queue.failed > 0 && (
      <Attention
        key="jobs"
        icon={<AlertTriangle className="h-4 w-4" />}
        href="/admin/jobs?state=FAILED"
        cta="Inspect"
      >
        <strong className="font-semibold">{queue.failed}</strong> job
        {queue.failed === 1 ? "" : "s"} exhausted every retry. Nothing will pick
        them up again.
      </Attention>
    ),
    content.stuck > 0 && (
      <Attention
        key="stuck"
        icon={<Clock className="h-4 w-4" />}
        href="/admin/jobs"
        cta="Re-run"
      >
        <strong className="font-semibold">{content.stuck}</strong> record
        {content.stuck === 1 ? " is" : "s are"} still analysing well past the
        point a worker should have finished.
      </Attention>
    ),
    ai?.exhausted && (
      <Attention
        key="budget"
        icon={<Banknote className="h-4 w-4" />}
        href="/admin/system"
        cta="Review"
      >
        Today&apos;s AI budget is spent. Analysis is parked until the window
        rolls over — logging still works.
      </Attention>
    ),
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        eyebrow="Last 30 days · figures in UTC"
        title="Overview"
        subtitle="Whether the business is working and the system is healthy, on one screen."
      />

      {attention.length > 0 && (
        <Panel
          tone="clay"
          title="Needs a person"
          description="Everything else on this page is information. These are decisions."
        >
          <ul className="flex flex-col">{attention}</ul>
        </Panel>
      )}

      <MetricStrip>
        <Metric
          label="Accounts"
          value={users.total.toLocaleString()}
          note={`+${users.new7d} this week`}
          noteTone={users.new7d >= users.prev7d ? "sage" : "default"}
        />
        <Metric
          label="Paying"
          value={accounts.paid.toLocaleString()}
          note={`${Math.round(accounts.conversion * 100)}% of finished trials`}
        />
        <Metric
          label="Monthly recurring"
          value={inrShort(revenue.mrrPaise)}
          note="excl. lifetime"
        />
        <Metric
          label="Taken · 30d"
          value={inrShort(revenue.last30Paise)}
          note={
            <Delta now={revenue.last30Paise} before={revenue.prev30Paise} />
          }
          noteTone={
            revenue.last30Paise >= revenue.prev30Paise ? "sage" : "clay"
          }
        />
        <Metric
          label="Active · 7d"
          value={activity.active7d.toLocaleString()}
          note={`${activity.active24h} today`}
        />
      </MetricStrip>

      <div className="grid gap-4 lg:grid-cols-3">
        <TrendChart
          label="Sign-ups"
          points={trends.signups}
          headline={users.new30d.toLocaleString()}
          format={(v) => `${v} sign-up${v === 1 ? "" : "s"}`}
          note={
            <>
              <Delta now={users.new7d} before={users.prev7d} /> against the week
              before.
            </>
          }
        />
        <TrendChart
          label="Money in"
          points={trends.revenue}
          headline={inrShort(revenue.last30Paise)}
          format={(v) => inr(v)}
          note={`${revenue.payments30} payment${revenue.payments30 === 1 ? "" : "s"} captured in the window.`}
        />
        <TrendChart
          label="Records logged"
          points={trends.logs}
          headline={trends.logs
            .reduce((sum, p) => sum + p.value, 0)
            .toLocaleString()}
          format={(v) => `${v} record${v === 1 ? "" : "s"}`}
          note={`${activity.mealsToday} meals, ${activity.workoutsToday} workouts and ${activity.weighInsToday} weigh-ins logged today.`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Where the accounts stand"
          description="Every account is in exactly one of these four states."
          meta={`${users.total.toLocaleString()} total`}
        >
          <StackedBar
            segments={[
              { label: "Paying", value: accounts.paid, className: "bg-accent" },
              {
                label: "In trial",
                value: accounts.trialing,
                className: "bg-sage",
              },
              {
                label: "Trial over",
                value: accounts.lapsed,
                className: "bg-clay",
              },
              {
                label: "Never trialed",
                value: accounts.free,
                className: "bg-line-strong",
              },
            ]}
          />

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-4">
            {[
              ["Coaches", users.coaches],
              ["Athletes", users.athletes],
              ["Admins", users.admins],
              ["Coach links", coaching.accepted],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="mono-label">{label}</dt>
                <dd className="tabular mt-1.5 text-[15px] font-semibold text-fg">
                  {Number(value).toLocaleString()}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel
            title="Processing queue"
            meta={
              <StatusDot tone={queueState.tone} label={queueState.label} />
            }
            actions={
              <Link
                href="/admin/jobs"
                className="text-[12px] font-medium text-accent-text hover:underline"
              >
                Open
              </Link>
            }
          >
            <dl className="grid grid-cols-4 gap-4">
              {[
                ["Queued", queue.queued, "default"],
                ["Running", queue.running, "default"],
                ["Failed", queue.failed, queue.failed > 0 ? "clay" : "default"],
                ["Done", queue.done, "default"],
              ].map(([label, value, tone]) => (
                <div key={String(label)}>
                  <dt className="mono-label">{label}</dt>
                  <dd
                    className={cn(
                      "tabular mt-1.5 text-[18px] font-semibold",
                      tone === "clay" ? "text-clay-text" : "text-fg",
                    )}
                  >
                    {Number(value).toLocaleString()}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-4 border-t border-line pt-3.5 text-[12px] leading-relaxed text-fg-dim">
              {queue.queued === 0
                ? "Nothing waiting."
                : `Oldest job has been waiting ${Math.round(queue.oldestQueuedSec / 60)} minutes.`}{" "}
              {content.failedMeals + content.failedWorkouts > 0 &&
                `${content.failedMeals + content.failedWorkouts} records failed analysis this week.`}
            </p>
          </Panel>

          <Panel
            title="AI spend today"
            meta={
              budget && (
                <StatusDot tone={budget.tone} label={budget.label} />
              )
            }
            actions={
              <Link
                href="/admin/system"
                className="text-[12px] font-medium text-accent-text hover:underline"
              >
                Open
              </Link>
            }
          >
            {ai ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="tabular font-serif text-[30px] leading-none text-fg">
                    ${ai.spentUsd.toFixed(2)}
                  </span>
                  <span className="font-mono text-[11px] text-fg-dim">
                    of ${ai.budgetUsd.toFixed(2)}
                  </span>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-track">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      ai.exhausted ? "bg-clay" : "bg-accent",
                    )}
                    style={{
                      width: `${Math.min(100, (ai.spentUsd / Math.max(ai.budgetUsd, 0.01)) * 100)}%`,
                    }}
                  />
                </div>

                <p className="mt-3.5 text-[12px] leading-relaxed text-fg-dim">
                  A ceiling, not a bill. Past it, analysis is parked until
                  tomorrow rather than run — the athlete&apos;s log is still
                  recorded either way.
                </p>
              </>
            ) : (
              <p className="text-[12.5px] text-fg-dim">
                The spend ledger could not be read.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
