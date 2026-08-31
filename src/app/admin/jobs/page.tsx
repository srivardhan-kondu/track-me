import Link from "next/link";
import { Play, RotateCcw, Trash2, X } from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { Panel, StatusDot } from "@/components/admin/panel";
import { EmptyRow, Mono, Pager, Table, Td, Th, Tr } from "@/components/admin/table";
import {
  cancelJob,
  deleteRecord,
  drainQueue,
  purgeJobs,
  reprocessRecord,
  retryJob,
} from "@/app/actions/admin";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { FilterPills } from "@/components/ui/filter-pills";
import { Metric, MetricStrip } from "@/components/ui/metric";
import { ago, pageParam, queueHealth, stamp } from "@/lib/admin";
import { MAX_IN_FLIGHT } from "@/lib/jobs";
import { getQueueTally, getStalledRecords, listJobs } from "@/services/admin";

export const metadata = { title: "Queue" };

type Params = { state?: string; page?: string };

const STATES = ["QUEUED", "RUNNING", "DONE", "FAILED"] as const;

const TONE = {
  QUEUED: "secondary",
  RUNNING: "default",
  DONE: "success",
  FAILED: "destructive",
} as const;

function link(current: Params, change: Partial<Params>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...change })) {
    if (value) query.set(key, String(value));
  }
  if (!("page" in change)) query.delete("page");
  const s = query.toString();
  return s ? `/admin/jobs?${s}` : "/admin/jobs";
}

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const state = STATES.find((s) => s === params.state);

  const [queue, { rows, page }, stalled] = await Promise.all([
    getQueueTally(),
    listJobs({ state, page: pageParam(params.page) }),
    getStalledRecords(),
  ]);

  const health = queueHealth(queue);

  return (
    <>
      <PageHeader
        eyebrow="Whisper and vision calls, moved out of the request that made them"
        title="Processing queue"
        subtitle="An upload enqueues and returns. This is what happens next — and what to do when it does not."
        actions={
          <>
            <ActionButton
              action={drainQueue}
              label="Run now"
              icon={<Play className="h-3.5 w-3.5" />}
              success="Ran the jobs at the front of the queue."
              variant="default"
            />
            <ActionButton
              action={purgeJobs}
              label="Clear finished"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              confirm="Confirm — clear them"
              success="Finished jobs cleared."
              variant="ghost"
            />
          </>
        }
      />

      <MetricStrip>
        <Metric label="Queued" value={queue.queued.toLocaleString()} />
        <Metric
          label="Running"
          value={queue.running.toLocaleString()}
          note={`ceiling ${MAX_IN_FLIGHT}`}
        />
        <Metric
          label="Gave up"
          value={queue.failed.toLocaleString()}
          tone={queue.failed > 0 ? "clay" : "default"}
          note={queue.failed > 0 ? "nothing will retry these" : "none"}
        />
        <Metric
          label="Oldest wait"
          value={
            queue.queued === 0 ? "—" : `${Math.round(queue.oldestQueuedSec / 60)}m`
          }
          note={health.label}
        />
      </MetricStrip>

      {stalled.length > 0 && (
        <Panel
          tone="clay"
          title="Records an athlete is still waiting on"
          description="A meal or workout whose analysis failed, or that has been mid-flight far longer than a lease lasts. Re-running charges the AI budget again; deleting removes the athlete's record entirely."
          meta={`${stalled.length} record${stalled.length === 1 ? "" : "s"}`}
        >
          <ul className="flex flex-col">
            {stalled.slice(0, 12).map((record) => (
              <li
                key={`${record.kind}-${record.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-clay-line/60 py-3 last:border-0"
              >
                <Badge variant={record.status === "FAILED" ? "destructive" : "warning"}>
                  {record.status.toLowerCase()}
                </Badge>

                <span className="text-[12.5px] text-fg">
                  {record.title ?? `Untitled ${record.kind}`}
                </span>

                {record.user && (
                  <Link
                    href={`/admin/users/${record.user.id}`}
                    className="text-[12px] text-accent-text hover:underline"
                  >
                    {record.user.email ?? record.user.name}
                  </Link>
                )}

                <Mono className="min-w-0 flex-1 truncate" title={record.error ?? ""}>
                  {record.error ?? ago(record.createdAt)}
                </Mono>

                <div className="flex gap-2">
                  <ActionButton
                    action={reprocessRecord}
                    fields={{ kind: record.kind, id: record.id }}
                    label="Re-run"
                    icon={<RotateCcw className="h-3.5 w-3.5" />}
                    success="Queued for analysis again."
                  />
                  <ActionButton
                    action={deleteRecord}
                    fields={{ kind: record.kind, id: record.id }}
                    label="Delete"
                    confirm="Confirm — delete it"
                    success="Record deleted."
                    variant="ghost"
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <FilterPills
          active={state ?? null}
          options={[
            { label: "All", value: null, href: link(params, { state: undefined }) },
            ...STATES.map((s) => ({
              label: s[0] + s.slice(1).toLowerCase(),
              value: s,
              href: link(params, { state: s }),
            })),
          ]}
        />

        <StatusDot tone={health.tone} label={health.label} />
      </div>

      <Table
        head={
          <>
            <Th>Job</Th>
            <Th>Owner</Th>
            <Th>State</Th>
            <Th align="right">Attempts</Th>
            <Th align="right">Updated</Th>
            <Th />
          </>
        }
      >
        {rows.length === 0 ? (
          <EmptyRow colSpan={6}>
            Nothing in the queue. That is the normal state.
          </EmptyRow>
        ) : (
          rows.map((job) => (
            <Tr key={job.id}>
              <Td>
                <span className="text-[12.5px] text-fg">
                  {job.kind === "MEAL_ANALYSIS" ? "Meal analysis" : "Workout parse"}
                </span>
                <Mono className="mt-0.5 block max-w-[280px] truncate" title={job.lastError ?? job.targetId}>
                  {job.lastError ?? job.targetId}
                </Mono>
              </Td>

              <Td>
                {job.user ? (
                  <Link
                    href={`/admin/users/${job.user.id}`}
                    className="text-[12px] text-accent-text hover:underline"
                  >
                    {job.user.email ?? job.user.name}
                  </Link>
                ) : (
                  <Mono>{job.userId}</Mono>
                )}
              </Td>

              <Td>
                <Badge variant={TONE[job.state]}>{job.state.toLowerCase()}</Badge>
              </Td>

              <Td align="right">
                <span className="tabular text-[12.5px]">
                  {job.attempts}/{job.maxAttempts}
                </span>
              </Td>

              <Td align="right">
                <Mono title={stamp(job.updatedAt)}>{ago(job.updatedAt)}</Mono>
              </Td>

              <Td align="right">
                <div className="flex justify-end gap-2">
                  {job.state !== "DONE" && (
                    <ActionButton
                      action={retryJob}
                      fields={{ jobId: job.id }}
                      label="Retry"
                      icon={<RotateCcw className="h-3.5 w-3.5" />}
                      success="Requeued."
                    />
                  )}
                  {(job.state === "QUEUED" || job.state === "RUNNING") && (
                    <ActionButton
                      action={cancelJob}
                      fields={{ jobId: job.id }}
                      label="Cancel"
                      icon={<X className="h-3.5 w-3.5" />}
                      confirm="Confirm — cancel"
                      success="Job cancelled."
                      variant="ghost"
                    />
                  )}
                </div>
              </Td>
            </Tr>
          ))
        )}
      </Table>

      <Pager
        page={page}
        noun="jobs"
        href={(to) => link(params, { page: String(to) })}
      />
    </>
  );
}
