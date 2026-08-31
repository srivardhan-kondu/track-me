import Link from "next/link";

import { Panel } from "@/components/admin/panel";
import { StackedBar } from "@/components/admin/trend";
import { ClaimPayment } from "@/components/admin/payment-controls";
import { SearchField } from "@/components/admin/search-field";
import { EmptyRow, Mono, Pager, Table, Td, Th, Tr } from "@/components/admin/table";
import { PageHeader } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { FilterPills } from "@/components/ui/filter-pills";
import { Metric, MetricStrip } from "@/components/ui/metric";
import { ago, inr, inrShort, pageParam, stamp } from "@/lib/admin";
import { PRICES } from "@/lib/entitlements";
import { getRevenueBreakdown, listPayments } from "@/services/admin";

export const metadata = { title: "Payments" };

type Params = { status?: string; q?: string; page?: string };

const STATUSES = ["APPLIED", "UNMATCHED", "IGNORED"] as const;

/**
 * Three steps of the one violet, in the order the terms are sold. Segments of
 * a whole rather than four unrelated categories, so they separate by lightness
 * the way the rest of the system does.
 */
const TERM_FILL = ["bg-accent", "bg-sage", "bg-fat"];

const TONE = {
  APPLIED: "success",
  UNMATCHED: "warning",
  IGNORED: "secondary",
} as const;

function link(current: Params, change: Partial<Params>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...change })) {
    if (value) query.set(key, String(value));
  }
  if (!("page" in change)) query.delete("page");
  const s = query.toString();
  return s ? `/admin/payments?${s}` : "/admin/payments";
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const status = STATUSES.find((s) => s === params.status);

  const [breakdown, { rows, page }] = await Promise.all([
    getRevenueBreakdown(),
    listPayments({
      status,
      q: params.q?.trim() || undefined,
      page: pageParam(params.page),
    }),
  ]);

  const applied = breakdown.byStatus.find((r) => r.status === "APPLIED");
  const sold = breakdown.byTerm.filter((row) => row.term);

  return (
    <>
      <PageHeader
        eyebrow="Every captured payment, in the order it arrived"
        title="Payments"
        subtitle="Razorpay reports in paise and the payment page lets a buyer type any figure, so the amount is the only thing that says which plan was bought."
      />

      <MetricStrip>
        <Metric
          label="Taken · 30d"
          value={inrShort(breakdown.last30Paise)}
          note={`${breakdown.last30Count} payment${breakdown.last30Count === 1 ? "" : "s"}`}
        />
        <Metric
          label="All time"
          value={inrShort(applied?._sum.amount ?? 0)}
          note={`${applied?._count ?? 0} applied`}
          tone="sage"
        />
        <Metric
          label="Unattributed"
          value={inrShort(breakdown.unmatchedPaise)}
          note={`${breakdown.unmatchedCount} waiting`}
          tone={breakdown.unmatchedCount > 0 ? "clay" : "default"}
        />
      </MetricStrip>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="What people buy"
          description="Applied payments by term. Lifetime is bought once, so it counts toward the takings and toward nothing recurring."
          meta={`${applied?._count ?? 0} payments`}
        >
          {sold.length === 0 ? (
            <p className="text-[12.5px] text-fg-dim">
              Nothing has been sold yet.
            </p>
          ) : (
            <StackedBar
              segments={sold.map((row, i) => ({
                label: `${String(row.term)[0]}${String(row.term).slice(1).toLowerCase()} · ${inrShort(row._sum.amount ?? 0)}`,
                value: row._count,
                className: TERM_FILL[i % TERM_FILL.length],
              }))}
            />
          )}
        </Panel>

        <Panel
          title="Where a payment can land"
          description="Applied granted access. Unmatched was captured but credited to nobody. Ignored is an amount that is not one of our prices — a test rupee, a tip, a typo — which is what stops a ₹1 payment through the public page from becoming a lifetime plan."
        >
          <dl className="grid grid-cols-3 gap-4">
            {STATUSES.map((status) => {
              const row = breakdown.byStatus.find((r) => r.status === status);
              return (
                <div key={status}>
                  <dt className="mono-label">{status.toLowerCase()}</dt>
                  <dd className="tabular mt-1.5 text-[18px] font-semibold text-fg">
                    {(row?._count ?? 0).toLocaleString()}
                  </dd>
                  <dd className="tabular mt-0.5 font-mono text-[11px] text-fg-dim">
                    {inrShort(row?._sum.amount ?? 0)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Panel>
      </div>

      {breakdown.unmatchedCount > 0 && (
        <Panel
          tone="clay"
          title="Money nobody has been credited for"
          description="A payment taken through the razorpay.me page carries no account id — the payer types an email into a comment box and that is all there is to go on. Nothing is granted automatically on an email alone, because this merchant account serves more than one product. Attribute each one to the account that actually paid it."
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <FilterPills
          active={status ?? null}
          options={[
            { label: "All", value: null, href: link(params, { status: undefined }) },
            ...STATUSES.map((s) => ({
              label: s[0] + s.slice(1).toLowerCase(),
              value: s,
              href: link(params, { status: s }),
            })),
          ]}
        />

        <SearchField
          placeholder="Payment id, email, phone or comment"
          className="w-full max-w-[360px]"
        />
      </div>

      <Table
        head={
          <>
            <Th>Paid</Th>
            <Th align="right">Amount</Th>
            <Th>Bought</Th>
            <Th>Payer</Th>
            <Th>Account</Th>
            <Th align="right">Status</Th>
          </>
        }
      >
        {rows.length === 0 ? (
          <EmptyRow colSpan={6}>No payment matches that.</EmptyRow>
        ) : (
          rows.map((payment) => (
            <Tr key={payment.id}>
              <Td>
                <span title={stamp(payment.paidAt)}>{ago(payment.paidAt)}</span>
                <Mono className="mt-0.5 block" title={payment.id}>
                  {payment.id}
                </Mono>
              </Td>

              <Td align="right">
                <span className="tabular text-[13px] font-medium text-fg">
                  {inr(payment.amount)}
                </span>
                {payment.currency !== "INR" && (
                  <Mono className="ml-1">{payment.currency}</Mono>
                )}
              </Td>

              <Td>
                {payment.term ? (
                  payment.term[0] + payment.term.slice(1).toLowerCase()
                ) : (
                  <span
                    title={`Not one of our prices (${Object.values(PRICES)
                      .map(inr)
                      .join(", ")})`}
                  >
                    —
                  </span>
                )}
              </Td>

              <Td>
                <span className="block truncate text-[12px]">
                  {payment.email ?? "no email"}
                </span>
                {payment.note && (
                  <Mono className="mt-0.5 block max-w-[220px] truncate" title={payment.note}>
                    “{payment.note}”
                  </Mono>
                )}
              </Td>

              <Td>
                {payment.user ? (
                  <Link
                    href={`/admin/users/${payment.user.id}`}
                    className="text-[12px] text-accent-text hover:underline"
                  >
                    {payment.user.name ?? payment.user.email}
                  </Link>
                ) : payment.status === "UNMATCHED" ? (
                  <ClaimPayment paymentId={payment.id} suggested={payment.email} />
                ) : (
                  <Mono>—</Mono>
                )}
              </Td>

              <Td align="right">
                <Badge variant={TONE[payment.status]}>
                  {payment.status.toLowerCase()}
                </Badge>
              </Td>
            </Tr>
          ))
        )}
      </Table>

      <Pager
        page={page}
        noun="payments"
        href={(to) => link(params, { page: String(to) })}
      />
    </>
  );
}
