import { Skeleton } from "@/components/ui/skeleton";

/** The live logger takes the whole screen, so its placeholder does too. */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="safe-t mx-auto flex min-h-dvh max-w-lg flex-col gap-4 px-5 pt-6"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-20 rounded-[14px]" />
      </div>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[120px] rounded-2xl" />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
