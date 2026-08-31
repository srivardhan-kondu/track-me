import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { Panel } from "@/components/admin/panel";
import { EmptyRow, Mono, Table, Td, Th, Tr } from "@/components/admin/table";
import {
  AdminToggle,
  DeleteAccount,
  PlanControls,
  RoleControls,
  TrialControls,
} from "@/components/admin/user-controls";
import { ActionButton } from "@/components/admin/action-button";
import { reprocessRecord } from "@/app/actions/admin";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Metric, MetricStrip } from "@/components/ui/metric";
import {
  ago,
  emailIsAdmin,
  inr,
  stamp,
  shortDate,
  STATE_LABEL,
  STATE_TONE,
} from "@/lib/admin";
import { requireAdmin } from "@/lib/session";
import { initials } from "@/lib/utils";
import { getUserDetail } from "@/services/admin";

export const metadata = { title: "Account" };

/** A label and a value, stacked — the console's smallest read-only field. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="mono-label">{label}</dt>
      <dd className="mt-1.5 text-[12.5px] text-fg-muted">{children}</dd>
    </div>
  );
}

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [admin, detail] = await Promise.all([requireAdmin(), getUserDetail(id)]);
  if (!detail) notFound();

  const {
    user,
    payments,
    lifetimeValuePaise,
    lastActiveAt,
    lastMeal,
    lastWorkout,
    lastWeight,
    failedMeals,
    jobs,
    coachLinks,
    athleteLinks,
    audit,
  } = detail;

  const logged =
    user._count.meals + user._count.workouts + user._count.weightEntries;

  return (
    <>
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-fg-dim transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        All users
      </Link>

      <header className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <Avatar className="h-14 w-14">
          {user.image && <AvatarImage src={user.image} alt="" />}
          <AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-serif text-[26px] leading-none text-fg">
              {user.name ?? "Unnamed account"}
            </h1>
            <Badge variant={STATE_TONE[user.state]}>
              {STATE_LABEL[user.state]}
            </Badge>
            {user.isAdmin && (
              <Badge variant="outline">
                <ShieldCheck className="h-3 w-3" />
                Admin
              </Badge>
            )}
            {user.role === "COACH" && <Badge variant="secondary">Coach</Badge>}
          </div>

          <p className="mt-2 text-[13px] text-fg-dim">
            {user.email ?? "no email on file"}
          </p>
          <Mono className="mt-1 block" title="Account id">
            {user.id}
          </Mono>
        </div>
      </header>

      <MetricStrip>
        <Metric
          label="Records logged"
          value={logged.toLocaleString()}
          note={`${user._count.meals} meals · ${user._count.workouts} workouts`}
        />
        <Metric
          label="Last active"
          value={lastActiveAt ? ago(lastActiveAt) : "never"}
          note={lastActiveAt ? shortDate(lastActiveAt) : "nothing logged yet"}
        />
        <Metric
          label="Paid to date"
          value={inr(lifetimeValuePaise)}
          note={`${user._count.payments} payment${user._count.payments === 1 ? "" : "s"}`}
          tone={lifetimeValuePaise > 0 ? "sage" : "default"}
        />
        <Metric
          label="Joined"
          value={shortDate(user.createdAt)}
          note={ago(user.createdAt)}
        />
      </MetricStrip>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Payments" meta={`${payments.length} shown`}>
            <Table
              className="border-0 bg-transparent"
              head={
                <>
                  <Th>Paid</Th>
                  <Th>Amount</Th>
                  <Th>Term</Th>
                  <Th>Status</Th>
                  <Th align="right">Reference</Th>
                </>
              }
            >
              {payments.length === 0 ? (
                <EmptyRow colSpan={5}>
                  This account has never paid anything.
                </EmptyRow>
              ) : (
                payments.map((payment) => (
                  <Tr key={payment.id}>
                    <Td>{shortDate(payment.paidAt)}</Td>
                    <Td>
                      <span className="tabular text-fg">
                        {inr(payment.amount)}
                      </span>
                    </Td>
                    <Td>{payment.term ?? "—"}</Td>
                    <Td>
                      <Badge
                        variant={
                          payment.status === "APPLIED"
                            ? "success"
                            : payment.status === "UNMATCHED"
                              ? "warning"
                              : "secondary"
                        }
                      >
                        {payment.status.toLowerCase()}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <Mono>{payment.id}</Mono>
                    </Td>
                  </Tr>
                ))
              )}
            </Table>
          </Panel>

          <Panel
            title="What they have been doing"
            description="The most recent entry of each kind, and whether its analysis finished."
          >
            <dl className="grid gap-5 sm:grid-cols-3">
              <Field label="Last meal">
                {lastMeal ? (
                  <>
                    {lastMeal.title ?? "Untitled"}
                    <span className="block text-fg-dim">
                      {ago(lastMeal.eatenAt)} · {lastMeal.status.toLowerCase()}
                    </span>
                  </>
                ) : (
                  "None"
                )}
              </Field>
              <Field label="Last workout">
                {lastWorkout ? (
                  <>
                    {lastWorkout.title ?? "Untitled"}
                    <span className="block text-fg-dim">
                      {ago(lastWorkout.performedAt)} ·{" "}
                      {lastWorkout.status.toLowerCase()}
                    </span>
                  </>
                ) : (
                  "None"
                )}
              </Field>
              <Field label="Last weigh-in">
                {lastWeight ? (
                  <>
                    {lastWeight.weightKg} kg
                    <span className="block text-fg-dim">
                      {shortDate(lastWeight.day)}
                    </span>
                  </>
                ) : (
                  "None"
                )}
              </Field>
            </dl>

            <dl className="mt-6 grid gap-5 border-t border-line pt-5 sm:grid-cols-4">
              <Field label="Photos">{user._count.progressPhotos}</Field>
              <Field label="Comments">{user._count.comments}</Field>
              <Field label="Failed meals">
                <span className={failedMeals > 0 ? "text-clay-text" : undefined}>
                  {failedMeals}
                </span>
              </Field>
              <Field label="Sessions">{user._count.sessions}</Field>
            </dl>
          </Panel>

          <Panel
            title="Queue"
            description="The AI jobs this account has queued, newest first."
            meta={`${jobs.length} shown`}
          >
            {jobs.length === 0 ? (
              <p className="text-[12.5px] text-fg-dim">
                Nothing of theirs is in the queue.
              </p>
            ) : (
              <ul className="flex flex-col">
                {jobs.map((job) => (
                  <li
                    key={job.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line py-2.5 last:border-0"
                  >
                    <Badge
                      variant={
                        job.state === "DONE"
                          ? "success"
                          : job.state === "FAILED"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {job.state.toLowerCase()}
                    </Badge>
                    <span className="text-[12.5px] text-fg-muted">
                      {job.kind === "MEAL_ANALYSIS" ? "Meal" : "Workout"}
                    </span>
                    <Mono className="min-w-0 flex-1 truncate">
                      {job.lastError ?? job.targetId}
                    </Mono>
                    <Mono>{ago(job.updatedAt)}</Mono>
                    {job.state === "FAILED" && (
                      <ActionButton
                        action={reprocessRecord}
                        fields={{
                          kind: job.kind === "MEAL_ANALYSIS" ? "meal" : "workout",
                          id: job.targetId,
                        }}
                        label="Re-run"
                        success="Queued for analysis again."
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Coaching"
            description="Only an accepted link lets a coach read this athlete's training."
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mono-label">Coaches with access</p>
                {coachLinks.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-fg-dim">None.</p>
                ) : (
                  <ul className="mt-2.5 flex flex-col gap-2">
                    {coachLinks.map((link) => (
                      <li
                        key={link.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <Link
                          href={`/admin/users/${link.coach.id}`}
                          className="truncate text-[12.5px] text-fg-muted hover:text-fg"
                        >
                          {link.coach.name ?? link.coach.email}
                        </Link>
                        <Badge
                          variant={
                            link.status === "ACCEPTED"
                              ? "success"
                              : link.status === "PENDING"
                                ? "warning"
                                : "secondary"
                          }
                        >
                          {link.status.toLowerCase()}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mono-label">Athletes they coach</p>
                {athleteLinks.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-fg-dim">None.</p>
                ) : (
                  <ul className="mt-2.5 flex flex-col gap-2">
                    {athleteLinks.map((link) => (
                      <li
                        key={link.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <Link
                          href={`/admin/users/${link.athlete.id}`}
                          className="truncate text-[12.5px] text-fg-muted hover:text-fg"
                        >
                          {link.athlete.name ?? link.athlete.email}
                        </Link>
                        <Badge
                          variant={
                            link.status === "ACCEPTED"
                              ? "success"
                              : link.status === "PENDING"
                                ? "warning"
                                : "secondary"
                          }
                        >
                          {link.status.toLowerCase()}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel
            title="Entitlement"
            description={
              user.state === "PAID"
                ? `Paying${user.planExpiresAt ? `, until ${shortDate(user.planExpiresAt)}` : " — lifetime, no expiry"}.`
                : user.state === "TRIAL"
                  ? `In trial until ${shortDate(user.trialEndsAt)}.`
                  : user.state === "LAPSED"
                    ? `Trial ended ${ago(user.trialEndsAt)}.`
                    : "Never started a trial."
            }
          >
            <PlanControls
              userId={user.id}
              term={user.planTerm}
              paying={user.state === "PAID"}
            />
          </Panel>

          <Panel
            title="Trial"
            description="Adds days from today, or from the current end date if it is still running."
          >
            <TrialControls userId={user.id} />
          </Panel>

          <Panel title="Role">
            <RoleControls userId={user.id} role={user.role} />
          </Panel>

          <Panel
            title="Admin access"
            description="Opens this console, which reads and edits every account."
          >
            <AdminToggle
              userId={user.id}
              isAdmin={user.isAdmin}
              isSelf={user.id === admin.id}
              byEmail={emailIsAdmin(user.email)}
            />
          </Panel>

          <Panel title="Profile">
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
              <Field label="Gender">{user.gender?.toLowerCase() ?? "—"}</Field>
              <Field label="Age">{user.age ?? "—"}</Field>
              <Field label="Height">
                {user.heightCm ? `${user.heightCm} cm` : "—"}
              </Field>
              <Field label="Time zone">{user.timeZone ?? "—"}</Field>
              <Field label="Onboarded">
                {user.onboardedAt ? shortDate(user.onboardedAt) : "not yet"}
              </Field>
              <Field label="Sign-in">
                {user._count.accounts > 0 ? "Google" : "Credentials"}
              </Field>
            </dl>
          </Panel>

          <Panel
            title="History"
            description="What admins have done to this account."
          >
            {audit.length === 0 ? (
              <p className="text-[12.5px] text-fg-dim">Nothing yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {audit.map((entry) => (
                  <li key={entry.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                    <p className="text-[12.5px] text-fg-muted">{entry.summary}</p>
                    <Mono className="mt-1 block">
                      {entry.actorEmail ?? "unknown"} · {stamp(entry.createdAt)}
                    </Mono>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            tone="clay"
            title="Delete this account"
            description="Everything they logged goes with it. Payments stay on the books."
          >
            <DeleteAccount userId={user.id} email={user.email} />
          </Panel>
        </div>
      </div>
    </>
  );
}
