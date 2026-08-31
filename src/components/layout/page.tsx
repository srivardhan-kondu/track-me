import { cn } from "@/lib/utils";

/**
 * The three-part rhythm every screen keeps: a quiet header carrying one
 * primary action, then content, then a context rail.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  /** Small mono line above the title — a date, a window, a count. */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-4",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="mono-label mb-2">{eyebrow}</p>}
        <h1 className="font-serif text-[28px] leading-none text-fg sm:text-[32px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2.5 text-[13px] leading-relaxed text-fg-dim">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
      )}
    </header>
  );
}

/** Titles a block of content; `meta` sits opposite in mono. */
export function SectionHeading({
  children,
  meta,
  className,
}: {
  children: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-baseline justify-between gap-4", className)}
    >
      <h2 className="text-[12.5px] font-semibold text-fg">{children}</h2>
      {meta && (
        <span className="tabular shrink-0 font-mono text-[11px] text-fg-dim">
          {meta}
        </span>
      )}
    </div>
  );
}

/** A day divider inside a grouped list — a rule with the day's totals on it. */
export function DayDivider({
  label,
  meta,
  className,
}: {
  label: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 pt-1", className)}>
      <span className="text-[12.5px] font-semibold text-fg">{label}</span>
      <span className="h-px flex-1 bg-line" />
      {meta && (
        <span className="tabular shrink-0 font-mono text-[11px] uppercase tracking-wide text-fg-dim">
          {meta}
        </span>
      )}
    </div>
  );
}

/**
 * Day-one and nothing-here states. They say what happens next rather than
 * reporting an absence.
 */
export function EmptyState({
  title,
  body,
  steps,
  action,
  className,
}: {
  title: string;
  body?: React.ReactNode;
  /** Numbered next steps; the first is highlighted as the one to take now. */
  steps?: { title: string; body: string }[];
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-line-strong px-6 py-10",
        className,
      )}
    >
      <div className="mx-auto max-w-md">
        <p className="font-serif text-xl text-fg">{title}</p>
        {body && (
          <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">{body}</p>
        )}

        {steps && steps.length > 0 && (
          <ol className="mt-6 flex flex-col gap-4">
            {steps.map((step, i) => (
              <li key={step.title} className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border font-mono text-[10px] font-medium",
                    i === 0
                      ? "border-accent-line text-accent-text"
                      : "border-line-strong text-fg-dim",
                  )}
                >
                  {i + 1}
                </span>
                <div>
                  <p
                    className={cn(
                      "text-[13px] font-semibold",
                      i === 0 ? "text-fg" : "text-fg-muted",
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-dim">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}

        {action && <div className="mt-7 flex flex-wrap gap-2.5">{action}</div>}
      </div>
    </div>
  );
}
