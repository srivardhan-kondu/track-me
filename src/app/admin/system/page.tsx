import { Panel, ServiceRow, StatusDot } from "@/components/admin/panel";
import { TrendChart } from "@/components/admin/trend";
import { Mono, Table, Td, Th, Tr } from "@/components/admin/table";
import { PageHeader } from "@/components/layout/page";
import { Metric, MetricStrip } from "@/components/ui/metric";
import { adminEmails, budgetHealth } from "@/lib/admin";
import { devLoginEnabled, googleEnabled, reviewLoginEnabled } from "@/lib/auth";
import { MAX_IN_FLIGHT } from "@/lib/jobs";
import { LIMITS } from "@/lib/rate-limit";
import { checkoutEnabled, liveMode } from "@/lib/razorpay";
import { aiEnabled } from "@/services/ai/client";
import { getSystemStatus } from "@/services/admin";
import { storageProvider, usingObjectStorage } from "@/services/storage";
import { cn } from "@/lib/utils";

export const metadata = { title: "System" };

/** A rate-limit window in the units a person thinks in. */
function window(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${seconds / 60}m`;
  if (seconds < 86_400) return `${seconds / 3600}h`;
  return `${seconds / 86_400}d`;
}

function limitValue(bucket: string, max: number): string {
  return bucket === "uploadBytes"
    ? `${Math.round(max / (1024 * 1024))} MB`
    : max.toLocaleString();
}

export default async function AdminSystemPage() {
  const { latency, tables, budget, spend, rateLimitRows } =
    await getSystemStatus();

  const health = budget ? budgetHealth(budget.spentUsd, budget.budgetUsd) : null;
  const allowlist = adminEmails();

  return (
    <>
      <PageHeader
        eyebrow="What this deployment is actually wired to"
        title="System"
        subtitle="Configuration is read from the environment and reported here as present or absent. No secret is ever shown — only whether one is set."
      />

      <MetricStrip>
        <Metric
          label="Database"
          value={latency === null ? "down" : `${latency}`}
          unit={latency === null ? undefined : "ms"}
          tone={latency === null ? "clay" : "default"}
          note={latency === null ? "unreachable" : "round trip"}
        />
        <Metric
          label="AI spend today"
          value={budget ? `$${budget.spentUsd.toFixed(2)}` : "—"}
          note={budget ? `of $${budget.budgetUsd.toFixed(2)}` : "no ledger"}
          tone={budget?.exhausted ? "clay" : "default"}
        />
        <Metric
          label="Concurrency"
          value={MAX_IN_FLIGHT}
          note="jobs in flight, deployment-wide"
        />
        <Metric
          label="Live rate windows"
          value={rateLimitRows.toLocaleString()}
          note="swept by the worker"
        />
      </MetricStrip>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Services"
          description="Each of these is optional, and the app degrades rather than breaks when one is absent."
        >
          <ul className="flex flex-col">
            <ServiceRow
              name="Google sign-in"
              live={googleEnabled}
              detail={
                googleEnabled
                  ? "AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are set."
                  : "Not configured — sign-in falls back to the other providers."
              }
            />
            <ServiceRow
              name="OpenAI"
              live={aiEnabled()}
              detail={
                aiEnabled()
                  ? "Meals are read by the vision model and voice notes transcribed."
                  : "No key. Logs still work; macros come from the offline estimator."
              }
            />
            <ServiceRow
              name="Razorpay Checkout"
              live={checkoutEnabled}
              value={checkoutEnabled ? (liveMode ? "live keys" : "test keys") : undefined}
              detail={
                checkoutEnabled
                  ? liveMode
                    ? "Taking real money."
                    : "Test keys — payments are fake and grant real access."
                  : "No keys, so the payment sheet is hidden entirely."
              }
            />
            <ServiceRow
              name="Razorpay webhook"
              live={Boolean(process.env.RAZORPAY_WEBHOOK_SECRET)}
              detail={
                process.env.RAZORPAY_WEBHOOK_SECRET
                  ? "Deliveries are signature-checked before they grant anything."
                  : "Unset — the endpoint refuses every delivery."
              }
            />
            <ServiceRow
              name="Object storage"
              live={usingObjectStorage}
              value={storageProvider}
              detail={
                usingObjectStorage
                  ? "Photos and voice notes are served through short-lived presigned URLs."
                  : "Uploads go to the local filesystem, which a serverless host discards."
              }
            />
            <ServiceRow
              name="Queue cron"
              live={Boolean(process.env.CRON_SECRET)}
              detail={
                process.env.CRON_SECRET
                  ? "The scheduled sweep can authenticate to /api/jobs/run."
                  : "Unset — the sweep is refused, so nothing drains what an upload could not finish."
              }
            />
            <ServiceRow
              name="Reviewer sign-in"
              live={reviewLoginEnabled}
              detail={
                reviewLoginEnabled
                  ? "One shared password is live. Clear REVIEW_EMAIL or REVIEW_PASSWORD once the review is over."
                  : "Off, which is where it should be outside a gateway review."
              }
            />
            <ServiceRow
              name="Development sign-in"
              live={devLoginEnabled}
              detail={
                devLoginEnabled
                  ? "Password-less sign-in is available. Hard-gated on NODE_ENV, so it cannot exist in production."
                  : "Off in production, by construction."
              }
            />
            <ServiceRow
              name="Admin allowlist"
              live={allowlist.length > 0}
              value={allowlist.length > 0 ? `${allowlist.length} address${allowlist.length === 1 ? "" : "es"}` : undefined}
              detail={
                allowlist.length > 0
                  ? "ADMIN_EMAILS is set, so there is a way into this console that survives a database restore."
                  : "Unset. Console access depends entirely on the isAdmin column — lose every admin row and you need a redeploy."
              }
            />
          </ul>
        </Panel>

        <div className="flex flex-col gap-4">
          {budget && (
            <TrendChart
              label="AI spend, last 7 days"
              points={spend}
              headline={`$${budget.spentUsd.toFixed(2)}`}
              format={(v) => `$${v.toFixed(2)}`}
              note={
                <>
                  Ceiling is ${budget.budgetUsd.toFixed(2)} a day, from{" "}
                  <code className="text-fg-muted">AI_DAILY_BUDGET_USD</code>.
                  Past it, analysis waits for the next window rather than
                  running. Prices are estimates for a safety rail, not a bill.
                </>
              }
            />
          )}

          <Panel
            title="Budget"
            meta={
              health && (
                <StatusDot tone={health.tone} label={health.label} />
              )
            }
          >
            {budget ? (
              <div className="h-2 overflow-hidden rounded-full bg-track">
                <div
                  className={cn(
                    "h-full rounded-full",
                    budget.exhausted ? "bg-clay" : "bg-accent",
                  )}
                  style={{
                    width: `${Math.min(100, (budget.spentUsd / Math.max(budget.budgetUsd, 0.01)) * 100)}%`,
                  }}
                />
              </div>
            ) : (
              <p className="text-[12.5px] text-fg-dim">
                The spend ledger could not be read.
              </p>
            )}
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Tables"
          description="Row counts, so the shape of the data is visible without a psql session."
          bodyClassName="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3"
        >
          {tables.map((table) => (
            <div key={table.table}>
              <p className="mono-label">{table.table}</p>
              <p className="tabular mt-1 text-[14px] font-semibold text-fg">
                {table.rows.toLocaleString()}
              </p>
            </div>
          ))}
        </Panel>

        <Panel
          title="Rate limits"
          description="Per identifier, not global. Every limited surface in the app is in this list."
          bodyClassName="p-0"
        >
          <Table
            className="border-0 bg-transparent"
            head={
              <>
                <Th>Bucket</Th>
                <Th align="right">Allowance</Th>
                <Th align="right">Window</Th>
              </>
            }
          >
            {Object.entries(LIMITS).map(([bucket, limit]) => (
              <Tr key={bucket}>
                <Td>
                  <Mono className="text-fg-muted">{bucket}</Mono>
                </Td>
                <Td align="right">
                  <span className="tabular text-[12.5px] text-fg">
                    {limitValue(bucket, limit.max)}
                  </span>
                </Td>
                <Td align="right">
                  <Mono>{window(limit.windowSec)}</Mono>
                </Td>
              </Tr>
            ))}
          </Table>
        </Panel>
      </div>
    </>
  );
}
