import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";

import { Panel } from "@/components/admin/panel";
import { SearchField } from "@/components/admin/search-field";
import { EmptyRow, Mono, Pager, Table, Td, Th, Tr } from "@/components/admin/table";
import { PageHeader } from "@/components/layout/page";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FilterPills } from "@/components/ui/filter-pills";
import {
  ago,
  pageParam,
  shortDate,
  STATE_LABEL,
  STATE_TONE,
  type AccountState,
} from "@/lib/admin";
import { initials } from "@/lib/utils";
import { listUsers } from "@/services/admin";

export const metadata = { title: "Users" };

type Params = {
  q?: string;
  state?: string;
  role?: string;
  admin?: string;
  sort?: string;
  page?: string;
};

const STATES: AccountState[] = ["PAID", "TRIAL", "LAPSED", "FREE"];
const SORTS = [
  { value: "recent", label: "Newest" },
  { value: "active", label: "Most logged" },
  { value: "spend", label: "Most payments" },
  { value: "name", label: "Name" },
] as const;

/** Rebuilds the address with one parameter changed, keeping the rest. */
function link(current: Params, change: Partial<Params>): string {
  const query = new URLSearchParams();
  const merged = { ...current, ...change };

  for (const [key, value] of Object.entries(merged)) {
    if (value) query.set(key, String(value));
  }
  // Any change of filter invalidates the page number it was paired with.
  if (!("page" in change)) query.delete("page");

  const s = query.toString();
  return s ? `/admin/users?${s}` : "/admin/users";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;

  const state = STATES.find((s) => s === params.state);
  const role =
    params.role === "COACH" || params.role === "ATHLETE" ? params.role : undefined;
  const sort =
    SORTS.find((s) => s.value === params.sort)?.value ?? ("recent" as const);

  const { rows, page } = await listUsers({
    q: params.q?.trim() || undefined,
    state,
    role,
    admin: params.admin === "1",
    sort,
    page: pageParam(params.page),
  });

  return (
    <>
      <PageHeader
        eyebrow={`${page.total.toLocaleString()} account${page.total === 1 ? "" : "s"}`}
        title="Users"
        subtitle="Every account, what it is entitled to, and what it has actually done."
      />

      <Panel tone="quiet" className="p-0" bodyClassName="flex flex-col gap-4">
        <SearchField
          placeholder="Search by name, email or account id"
          className="max-w-[420px]"
        />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <FilterPills
            active={state ?? null}
            options={[
              { label: "All", value: null, href: link(params, { state: undefined }) },
              ...STATES.map((s) => ({
                label: STATE_LABEL[s],
                value: s,
                href: link(params, { state: s }),
              })),
            ]}
          />

          <FilterPills
            active={role ?? (params.admin === "1" ? "ADMIN" : null)}
            options={[
              {
                label: "Coaches",
                value: "COACH",
                href: link(params, { role: role === "COACH" ? undefined : "COACH", admin: undefined }),
              },
              {
                label: "Admins",
                value: "ADMIN",
                href: link(params, {
                  admin: params.admin === "1" ? undefined : "1",
                  role: undefined,
                }),
              },
            ]}
          />

          <div className="flex items-center gap-2">
            <span className="mono-label">Sort</span>
            <FilterPills
              active={sort}
              options={SORTS.map((s) => ({
                label: s.label,
                value: s.value,
                href: link(params, { sort: s.value }),
              }))}
            />
          </div>
        </div>
      </Panel>

      <Table
        head={
          <>
            <Th>Account</Th>
            <Th>State</Th>
            <Th>Plan</Th>
            <Th>Role</Th>
            <Th align="right">Logged</Th>
            <Th align="right">Joined</Th>
            <Th />
          </>
        }
      >
        {rows.length === 0 ? (
          <EmptyRow colSpan={7}>
            No account matches that. Try a different search or clear the filters.
          </EmptyRow>
        ) : (
          rows.map((user) => {
            const logged =
              user._count.meals + user._count.workouts + user._count.weightEntries;

            return (
              <Tr key={user.id}>
                <Td>
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="flex items-center gap-3"
                  >
                    <Avatar className="h-8 w-8">
                      {user.image && <AvatarImage src={user.image} alt="" />}
                      <AvatarFallback className="text-[10px]">
                        {initials(user.name, user.email)}
                      </AvatarFallback>
                    </Avatar>

                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[12.5px] font-medium text-fg">
                          {user.name ?? "Unnamed"}
                        </span>
                        {user.isAdmin && (
                          <ShieldCheck
                            className="h-3.5 w-3.5 shrink-0 text-accent-text"
                            aria-label="Admin"
                          />
                        )}
                      </span>
                      <span className="block truncate text-[11.5px] text-fg-dim">
                        {user.email ?? "no email"}
                      </span>
                    </span>
                  </Link>
                </Td>

                <Td>
                  <Badge variant={STATE_TONE[user.state]}>
                    {STATE_LABEL[user.state]}
                  </Badge>
                </Td>

                <Td>
                  {user.planTerm ? (
                    <span className="text-[12px] text-fg-muted">
                      {user.planTerm[0] + user.planTerm.slice(1).toLowerCase()}
                      <Mono className="ml-1.5">
                        {user.planExpiresAt
                          ? `to ${shortDate(user.planExpiresAt)}`
                          : "no expiry"}
                      </Mono>
                    </span>
                  ) : (
                    <Mono>—</Mono>
                  )}
                </Td>

                <Td>
                  <span className="text-[12px] text-fg-muted">
                    {user.role === "COACH" ? "Coach" : "Athlete"}
                  </span>
                </Td>

                <Td align="right">
                  <span className="tabular text-[12.5px] text-fg">
                    {logged.toLocaleString()}
                  </span>
                </Td>

                <Td align="right">
                  <Mono title={user.createdAt.toISOString()}>
                    {ago(user.createdAt)}
                  </Mono>
                </Td>

                <Td align="right">
                  <Link
                    href={`/admin/users/${user.id}`}
                    aria-label={`Open ${user.email ?? user.id}`}
                    className="inline-flex text-fg-faint transition-colors hover:text-accent-text"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Td>
              </Tr>
            );
          })
        )}
      </Table>

      <Pager
        page={page}
        noun="accounts"
        href={(to) => link(params, { page: String(to) })}
      />
    </>
  );
}
