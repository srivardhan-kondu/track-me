import { Skeleton } from "@/components/ui/skeleton";

/**
 * What a signed-in screen looks like before its data arrives: a header, a row
 * of actions, then content beside a rail — the same rhythm every page keeps,
 * so the real page lands on top of it without anything jumping.
 *
 * Shown by the `loading.tsx` files. They are what let a tap answer at once:
 * the app frame stays put, this fills the page area, and Next can prefetch
 * everything up to it before the link is even tapped.
 */
export function PageSkeleton({ rail = true }: { rail?: boolean }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56 rounded-[12px]" />
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Skeleton className="h-[42px] w-32 rounded-[14px]" />
        <Skeleton className="h-[42px] w-28 rounded-[14px]" />
        <Skeleton className="h-[42px] w-24 rounded-[14px]" />
      </div>

      <div
        className={
          rail
            ? "grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-start"
            : "grid gap-6"
        }
      >
        <div className="flex flex-col gap-3.5">
          <Skeleton className="h-4 w-20" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[92px] rounded-2xl" />
          ))}
        </div>

        {rail && (
          <div className="flex flex-col gap-3.5">
            <Skeleton className="h-[140px] rounded-2xl" />
            <Skeleton className="h-[180px] rounded-2xl" />
          </div>
        )}
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  );
}
