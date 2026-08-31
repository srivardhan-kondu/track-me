import Link from "next/link";

import { Panel } from "@/components/admin/panel";
import { EmptyRow, Mono, Pager, Table, Td, Th, Tr } from "@/components/admin/table";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { FilterPills } from "@/components/ui/filter-pills";
import { ago, pageParam, stamp } from "@/lib/admin";
import { auditActions, listAudit } from "@/services/admin";

export const metadata = { title: "Audit log" };

type Params = { action?: string; page?: string };

function link(current: Params, change: Partial<Params>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...change })) {
    if (value) query.set(key, String(value));
  }
  if (!("page" in change)) query.delete("page");
  const s = query.toString();
  return s ? `/admin/audit?${s}` : "/admin/audit";
}

/** Where a target lives, when it has a page of its own. */
function targetHref(type: string | null, id: string | null): string | null {
  if (type === "user" && id) return `/admin/users/${id}`;
  if (type === "payment") return "/admin/payments";
  if (type === "job" || type === "queue") return "/admin/jobs";
  return null;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;

  const [actions, { rows, page }] = await Promise.all([
    auditActions(),
    listAudit({ action: params.action, page: pageParam(params.page) }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Append-only · written before the change it describes"
        title="Audit log"
        subtitle="Every write made from this console. Nothing here can be edited or removed from inside the app."
      />

      {actions.length > 0 && (
        <FilterPills
          active={params.action ?? null}
          options={[
            { label: "Everything", value: null, href: link(params, { action: undefined }) },
            ...actions.map((action) => ({
              label: action,
              value: action,
              href: link(params, { action }),
            })),
          ]}
        />
      )}

      <Table
        head={
          <>
            <Th>When</Th>
            <Th>Who</Th>
            <Th>What</Th>
            <Th>Action</Th>
            <Th align="right">Target</Th>
          </>
        }
      >
        {rows.length === 0 ? (
          <EmptyRow colSpan={5}>
            Nothing has been done from the console yet.
          </EmptyRow>
        ) : (
          rows.map((entry) => {
            const href = targetHref(entry.targetType, entry.targetId);

            return (
              <Tr key={entry.id}>
                <Td>
                  <span title={stamp(entry.createdAt)}>
                    {ago(entry.createdAt)}
                  </span>
                </Td>

                <Td>
                  {entry.actorId ? (
                    <Link
                      href={`/admin/users/${entry.actorId}`}
                      className="text-[12px] text-accent-text hover:underline"
                    >
                      {entry.actorEmail ?? entry.actorId}
                    </Link>
                  ) : (
                    <span className="text-[12px]">
                      {entry.actorEmail ?? "unknown"}
                    </span>
                  )}
                </Td>

                <Td className="text-fg">{entry.summary}</Td>

                <Td>
                  <Badge variant="secondary">{entry.action}</Badge>
                </Td>

                <Td align="right">
                  {href ? (
                    <Link
                      href={href}
                      className="text-[12px] text-accent-text hover:underline"
                    >
                      {entry.targetType}
                    </Link>
                  ) : (
                    <Mono>{entry.targetType ?? "—"}</Mono>
                  )}
                </Td>
              </Tr>
            );
          })
        )}
      </Table>

      <Pager
        page={page}
        noun="entries"
        href={(to) => link(params, { page: String(to) })}
      />

      <Panel
        tone="quiet"
        title="Why this exists"
        description="Every write in this console happens to somebody else's account — a plan granted, a payment moved, an account deleted. Each one is recorded before it is applied, so an action that fails halfway still leaves a trace of having been attempted. The reason field on a plan change is the only thing that will explain, months from now, why one account has premium and no payment against it."
      />
    </>
  );
}
